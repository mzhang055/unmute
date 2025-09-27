interface TrackingStats {
  totalCount: number;
  lastPress: string;
}

interface SlackConfig {
  channelId: string;
  userToken: string;
}

interface FishConfig {
  apiKey: string;
  voiceId: string;
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

  // Fish TTS elements
  private fishApiKeyInput: HTMLInputElement;
  private voiceIdInput: HTMLInputElement;
  private saveFishBtn: HTMLButtonElement;
  private testFishBtn: HTMLButtonElement;
  private fishStatusEl: HTMLSpanElement;

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

    // Fish TTS elements
    this.fishApiKeyInput = document.getElementById('fishApiKey') as HTMLInputElement;
    this.voiceIdInput = document.getElementById('voiceId') as HTMLInputElement;
    this.saveFishBtn = document.getElementById('saveFishBtn') as HTMLButtonElement;
    this.testFishBtn = document.getElementById('testFishBtn') as HTMLButtonElement;
    this.fishStatusEl = document.getElementById('fishStatus') as HTMLSpanElement;

    if (!this.totalCountEl || !this.lastPressEl || !this.currentStatusEl || !this.clearBtn || !this.statusDiv ||
        !this.channelIdInput || !this.userTokenInput || !this.saveSlackBtn || !this.testSlackBtn || !this.slackStatusEl ||
        !this.fishApiKeyInput || !this.voiceIdInput || !this.saveFishBtn || !this.testFishBtn || !this.fishStatusEl) {
      throw new Error('Required DOM elements not found');
    }

    this.init();
  }

  private init(): void {
    this.clearBtn.addEventListener('click', this.handleClearStats.bind(this));
    this.saveSlackBtn.addEventListener('click', this.handleSaveSlackConfig.bind(this));
    this.testSlackBtn.addEventListener('click', this.handleTestSlack.bind(this));
    this.saveFishBtn.addEventListener('click', this.handleSaveFishConfig.bind(this));
    this.testFishBtn.addEventListener('click', this.handleTestFish.bind(this));

    this.loadAndDisplayStats();
    this.loadSlackConfig();
    this.loadFishConfig();

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

  private async loadFishConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['fishConfig']);
      const config: FishConfig = result.fishConfig;

      if (config) {
        this.fishApiKeyInput.value = config.apiKey || '';
        this.voiceIdInput.value = config.voiceId || '';
        this.updateFishStatus(true);
      } else {
        this.updateFishStatus(false);
      }
    } catch (error) {
      console.error('Error loading Fish config:', error);
      this.updateFishStatus(false);
    }
  }

  private async handleSaveFishConfig(): Promise<void> {
    try {
      const apiKey = this.fishApiKeyInput.value.trim();
      const voiceId = this.voiceIdInput.value.trim();

      if (!apiKey || !voiceId) {
        this.showStatus('Please fill in both API Key and Voice ID', 'error');
        return;
      }

      const config: FishConfig = { apiKey, voiceId };
      await chrome.storage.local.set({ fishConfig: config });

      this.updateFishStatus(true);
      this.showStatus('Fish TTS configuration saved!', 'success');
    } catch (error) {
      console.error('Error saving Fish config:', error);
      this.showStatus('Failed to save Fish configuration', 'error');
    }
  }

  private async handleTestFish(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['fishConfig']);
      const config: FishConfig = result.fishConfig;

      if (!config || !config.apiKey || !config.voiceId) {
        this.showStatus('Please save Fish configuration first', 'error');
        return;
      }

      this.testFishBtn.disabled = true;
      this.testFishBtn.textContent = 'Testing...';

      // Test TTS with a simple message
      const success = await this.testFishTTS('Hello! This is a test of Fish TTS.', config);

      if (success) {
        this.showStatus('Fish TTS test successful!', 'success');
      } else {
        this.showStatus('Fish TTS test failed', 'error');
      }
    } catch (error) {
      console.error('Error testing Fish TTS:', error);
      this.showStatus('Error testing Fish TTS', 'error');
    } finally {
      this.testFishBtn.disabled = false;
      this.testFishBtn.textContent = 'Test TTS';
    }
  }

  private async testFishTTS(text: string, config: FishConfig): Promise<boolean> {
    try {
      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'model': 'speech-1.5'
        },
        body: JSON.stringify({
          text: text,
          reference_id: config.voiceId,
          format: 'mp3'
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        // Play the audio
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        return true;
      } else {
        console.error('Fish TTS API error:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error calling Fish TTS API:', error);
      return false;
    }
  }

  private updateFishStatus(configured: boolean): void {
    if (configured) {
      this.fishStatusEl.textContent = 'Configured';
      this.fishStatusEl.className = 'fish-indicator configured';
    } else {
      this.fishStatusEl.textContent = 'Not configured';
      this.fishStatusEl.className = 'fish-indicator';
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