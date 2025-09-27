interface TrackingStats {
  totalCount: number;
  lastPress: string;
}

interface SlackConfig {
  channelId: string;
  userToken: string;
}

class PopupController {
  private totalCountEl: HTMLSpanElement;
  private lastPressEl: HTMLSpanElement;
  private currentStatusEl: HTMLSpanElement;
  private clearBtn: HTMLButtonElement;
  private statusDiv: HTMLDivElement;

  // Slack elements
  private channelIdInput: HTMLInputElement;
  private userTokenInput: HTMLInputElement;
  private saveSlackBtn: HTMLButtonElement;
  private testSlackBtn: HTMLButtonElement;
  private slackStatusEl: HTMLSpanElement;

  constructor() {
    this.totalCountEl = document.getElementById('totalCount') as HTMLSpanElement;
    this.lastPressEl = document.getElementById('lastPress') as HTMLSpanElement;
    this.currentStatusEl = document.getElementById('currentStatus') as HTMLSpanElement;
    this.clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;

    // Slack elements
    this.channelIdInput = document.getElementById('channelId') as HTMLInputElement;
    this.userTokenInput = document.getElementById('userToken') as HTMLInputElement;
    this.saveSlackBtn = document.getElementById('saveSlackBtn') as HTMLButtonElement;
    this.testSlackBtn = document.getElementById('testSlackBtn') as HTMLButtonElement;
    this.slackStatusEl = document.getElementById('slackStatus') as HTMLSpanElement;

    if (!this.totalCountEl || !this.lastPressEl || !this.currentStatusEl || !this.clearBtn || !this.statusDiv ||
        !this.channelIdInput || !this.userTokenInput || !this.saveSlackBtn || !this.testSlackBtn || !this.slackStatusEl) {
      throw new Error('Required DOM elements not found');
    }

    this.init();
  }

  private init(): void {
    this.clearBtn.addEventListener('click', this.handleClearStats.bind(this));
    this.saveSlackBtn.addEventListener('click', this.handleSaveSlackConfig.bind(this));
    this.testSlackBtn.addEventListener('click', this.handleTestSlack.bind(this));

    this.loadAndDisplayStats();
    this.loadSlackConfig();

    // Listen for updates from content script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'trackingUpdate') {
        this.updateStats();
        this.showActiveStatus();
      }
    });

    // Refresh stats every second when popup is open
    setInterval(() => this.loadAndDisplayStats(), 1000);
  }

  private async loadAndDisplayStats(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['trackingStats']);
      const stats: TrackingStats = result.trackingStats || { totalCount: 0, lastPress: 'Never' };

      this.totalCountEl.textContent = stats.totalCount.toString();
      this.lastPressEl.textContent = stats.lastPress;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const now = new Date();
      const timeString = now.toLocaleTimeString();

      const result = await chrome.storage.local.get(['trackingStats']);
      const currentStats: TrackingStats = result.trackingStats || { totalCount: 0, lastPress: 'Never' };

      const newStats: TrackingStats = {
        totalCount: currentStats.totalCount + 1,
        lastPress: timeString
      };

      await chrome.storage.local.set({ trackingStats: newStats });
      this.loadAndDisplayStats();
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  private showActiveStatus(): void {
    this.currentStatusEl.textContent = 'Active';
    this.currentStatusEl.className = 'stat-value status-active';

    // Reset to ready after 2 seconds
    setTimeout(() => {
      this.currentStatusEl.textContent = 'Ready';
      this.currentStatusEl.className = 'stat-value status-ready';
    }, 2000);
  }

  private async handleClearStats(): Promise<void> {
    try {
      const resetStats: TrackingStats = { totalCount: 0, lastPress: 'Never' };
      await chrome.storage.local.set({ trackingStats: resetStats });
      this.loadAndDisplayStats();
      this.showStatus('Stats cleared successfully!', 'success');
    } catch (error) {
      console.error('Error clearing stats:', error);
      this.showStatus('Failed to clear stats', 'error');
    }
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';

    // Auto-hide messages after 3 seconds
    setTimeout(() => this.hideStatus(), 3000);
  }

  private hideStatus(): void {
    this.statusDiv.style.display = 'none';
  }

  private async loadSlackConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config: SlackConfig = result.slackConfig;

      if (config) {
        this.channelIdInput.value = config.channelId || '';
        this.userTokenInput.value = config.userToken || '';
        this.updateSlackStatus(true);
      } else {
        this.updateSlackStatus(false);
      }
    } catch (error) {
      console.error('Error loading Slack config:', error);
      this.updateSlackStatus(false);
    }
  }

  private async handleSaveSlackConfig(): Promise<void> {
    try {
      const channelId = this.channelIdInput.value.trim();
      const userToken = this.userTokenInput.value.trim();

      if (!channelId || !userToken) {
        this.showStatus('Please fill in both Channel ID and User Token', 'error');
        return;
      }

      const config: SlackConfig = { channelId, userToken };
      await chrome.storage.local.set({ slackConfig: config });

      this.updateSlackStatus(true);
      this.showStatus('Slack configuration saved!', 'success');
    } catch (error) {
      console.error('Error saving Slack config:', error);
      this.showStatus('Failed to save configuration', 'error');
    }
  }

  private async handleTestSlack(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config: SlackConfig = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.showStatus('Please save configuration first', 'error');
        return;
      }

      this.testSlackBtn.disabled = true;
      this.testSlackBtn.textContent = 'Testing...';

      const success = await this.sendSlackMessage('🔧 Test message from Unmute Tracker extension', config);

      if (success) {
        this.showStatus('Test message sent successfully!', 'success');
      } else {
        this.showStatus('Failed to send test message', 'error');
      }
    } catch (error) {
      console.error('Error testing Slack:', error);
      this.showStatus('Error testing Slack integration', 'error');
    } finally {
      this.testSlackBtn.disabled = false;
      this.testSlackBtn.textContent = 'Test Message';
    }
  }

  private async sendSlackMessage(message: string, config: SlackConfig): Promise<boolean> {
    try {
      console.log('Sending Slack message to channel:', config.channelId);

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channelId,
          text: message
        })
      });

      const data = await response.json();
      console.log('Slack API response:', data);

      if (data.ok === true) {
        return true;
      } else {
        console.error('Slack API error:', data.error);

        // Show specific error message in UI
        let errorMessage = 'Failed to send message';
        if (data.error === 'channel_not_found') {
          errorMessage = 'Channel not found. Check the Channel ID.';
        } else if (data.error === 'invalid_auth') {
          errorMessage = 'Invalid user token. Check your token.';
        } else if (data.error === 'not_in_channel') {
          errorMessage = 'User not in channel. Join the channel first.';
        } else if (data.error === 'missing_scope') {
          errorMessage = 'User token missing permissions. Add chat:write scope.';
        } else if (data.error) {
          errorMessage = `Slack error: ${data.error}`;
        }

        this.showStatus(errorMessage, 'error');
        return false;
      }
    } catch (error) {
      console.error('Network error sending Slack message:', error);
      this.showStatus('Network error. Check your connection.', 'error');
      return false;
    }
  }

  private updateSlackStatus(configured: boolean): void {
    if (configured) {
      this.slackStatusEl.textContent = 'Configured';
      this.slackStatusEl.className = 'slack-indicator configured';
    } else {
      this.slackStatusEl.textContent = 'Not configured';
      this.slackStatusEl.className = 'slack-indicator';
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupController();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
});