interface TrackingStats {
  totalCount: number;
  lastPress: string;
}

class PopupController {
  private totalCountEl: HTMLSpanElement;
  private lastPressEl: HTMLSpanElement;
  private currentStatusEl: HTMLSpanElement;
  private clearBtn: HTMLButtonElement;
  private statusDiv: HTMLDivElement;

  constructor() {
    this.totalCountEl = document.getElementById('totalCount') as HTMLSpanElement;
    this.lastPressEl = document.getElementById('lastPress') as HTMLSpanElement;
    this.currentStatusEl = document.getElementById('currentStatus') as HTMLSpanElement;
    this.clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;

    if (!this.totalCountEl || !this.lastPressEl || !this.currentStatusEl || !this.clearBtn || !this.statusDiv) {
      throw new Error('Required DOM elements not found');
    }

    this.init();
  }

  private init(): void {
    this.clearBtn.addEventListener('click', this.handleClearStats.bind(this));
    this.loadAndDisplayStats();

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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    new PopupController();
  } catch (error) {
    console.error('Failed to initialize popup:', error);
  }
});