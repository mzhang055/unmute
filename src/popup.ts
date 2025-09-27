import { ButtonClickMessage, MessageResponse } from './types';

class PopupController {
  private actionBtn: HTMLButtonElement;
  private statusDiv: HTMLDivElement;

  constructor() {
    this.actionBtn = document.getElementById('actionBtn') as HTMLButtonElement;
    this.statusDiv = document.getElementById('status') as HTMLDivElement;

    if (!this.actionBtn || !this.statusDiv) {
      throw new Error('Required DOM elements not found');
    }

    this.init();
  }

  private init(): void {
    this.actionBtn.addEventListener('click', this.handleButtonClick.bind(this));
  }

  private async handleButtonClick(): Promise<void> {
    try {
      this.setButtonState(true);
      this.hideStatus();

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      const message: ButtonClickMessage = { action: 'buttonClicked' };

      const response = await chrome.tabs.sendMessage(tabs[0].id, message) as MessageResponse;

      if (response?.status === 'success') {
        this.showStatus('Action completed successfully!', 'success');
      } else {
        throw new Error(response?.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Popup error:', error);
      this.showStatus(
        error instanceof Error ? error.message : 'An error occurred',
        'error'
      );
    } finally {
      this.setButtonState(false);
    }
  }

  private setButtonState(disabled: boolean): void {
    this.actionBtn.disabled = disabled;
    this.actionBtn.textContent = disabled ? 'Processing...' : 'Click me';
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => this.hideStatus(), 3000);
    }
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