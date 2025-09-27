import { ButtonClickMessage, MessageResponse } from './types';

class ContentScript {
  private static instance: ContentScript;

  constructor() {
    if (ContentScript.instance) {
      return ContentScript.instance;
    }

    ContentScript.instance = this;
    this.init();
  }

  private init(): void {
    this.setupMessageListener();
    this.log('Content script loaded');
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (
        request: ButtonClickMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: MessageResponse) => void
      ): boolean => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Indicates we will send a response asynchronously
      }
    );
  }

  private async handleMessage(
    request: ButtonClickMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): Promise<void> {
    try {
      this.log('Received message:', request);

      switch (request.action) {
        case 'buttonClicked':
          await this.handleButtonClick();
          sendResponse({ status: 'success', message: 'Button click handled' });
          break;

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleButtonClick(): Promise<void> {
    this.log('Button clicked in popup');

    // Example: Add a visual indicator to the page
    this.addVisualIndicator();

    // Add your custom page interaction logic here
    // For example:
    // - Find and interact with specific elements
    // - Modify page content
    // - Extract data from the page
    // - Communicate with external APIs
  }

  private addVisualIndicator(): void {
    // Remove any existing indicator
    const existingIndicator = document.getElementById('unmute-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create a new indicator
    const indicator = document.createElement('div');
    indicator.id = 'unmute-indicator';
    indicator.textContent = 'Unmute Extension Active!';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1a73e8;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(indicator);

    // Remove the indicator after 3 seconds
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }, 3000);
  }

  private log(message: string, ...args: unknown[]): void {
    console.log(`[Unmute Content Script] ${message}`, ...args);
  }
}

// Initialize the content script
new ContentScript();