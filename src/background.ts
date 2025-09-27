class BackgroundService {
  private static instance: BackgroundService;

  constructor() {
    if (BackgroundService.instance) {
      return BackgroundService.instance;
    }

    BackgroundService.instance = this;
    this.init();
  }

  private init(): void {
    this.setupInstallListener();
    this.setupActionListener();
    this.setupContextMenus();
    this.setupMessageListener();
    this.log('Background service initialized');
  }

  private setupInstallListener(): void {
    chrome.runtime.onInstalled.addListener((details) => {
      this.log('Extension installed/updated:', details.reason);

      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });
  }

  private setupActionListener(): void {
    chrome.action.onClicked.addListener(async (tab) => {
      this.log('Extension icon clicked for tab:', tab.id);

      try {
        if (!tab.id) {
          throw new Error('No tab ID available');
        }

        // You can perform actions when the extension icon is clicked
        // This is an alternative to the popup interface
        await this.handleIconClick(tab);
      } catch (error) {
        console.error('Error handling icon click:', error);
      }
    });
  }

  private setupContextMenus(): void {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'unmute-action',
        title: 'Unmute Action',
        contexts: ['page', 'selection'],
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.log('Context menu clicked:', info.menuItemId);

      if (info.menuItemId === 'unmute-action' && tab?.id) {
        this.handleContextMenuClick(info, tab);
      }
    });
  }

  private async handleFirstInstall(): Promise<void> {
    this.log('First time installation');

    // Set default settings
    await chrome.storage.sync.set({
      isEnabled: true,
      settings: {
        autoActivate: false,
        showNotifications: true,
      },
    });

    // Optionally open welcome page
    // chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }

  private async handleUpdate(previousVersion?: string): Promise<void> {
    this.log('Extension updated from version:', previousVersion);

    // Handle any migration logic here
    try {
      const result = await chrome.storage.sync.get(['settings']);
      if (!result.settings) {
        // Migrate old settings or set defaults
        await chrome.storage.sync.set({
          settings: {
            autoActivate: false,
            showNotifications: true,
          },
        });
      }
    } catch (error) {
      console.error('Error during update migration:', error);
    }
  }

  private async handleIconClick(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.id) return;

    try {
      // Send a message to the content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'iconClicked',
        tabInfo: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
        },
      });
    } catch (error) {
      // Content script might not be loaded, inject it
      await this.injectContentScript(tab.id);
    }
  }

  private async handleContextMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (!tab.id) return;

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'contextMenuClicked',
        menuInfo: info,
      });
    } catch (error) {
      console.error('Error sending context menu message:', error);
    }
  }

  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      this.log('Content script injected into tab:', tabId);
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message.action === 'sendSlackMessage') {
        await this.sendSlackNotification();
        sendResponse({ status: 'success' });
      }
      return true; // Indicates we will send a response asynchronously
    });
  }

  private async sendSlackNotification(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.log('Slack not configured, skipping notification');
        return;
      }

      this.log('Sending Slack notification to channel:', config.channelId);

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channelId,
          text: '🎤 microphone triggered'
        })
      });

      const data = await response.json();
      this.log('Slack API response:', data);

      if (data.ok) {
        this.log('Slack message sent successfully');
      } else {
        console.error('Slack API error:', data.error);
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  private log(message: string, ...args: unknown[]): void {
    console.log(`[Unmute Background] ${message}`, ...args);
  }
}

// Initialize the background service
new BackgroundService();