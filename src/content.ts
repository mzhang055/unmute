import { ButtonClickMessage, MessageResponse } from './types';
/// <reference path="./types/speech.d.ts" />

class ContentScript {
  private static instance: ContentScript;
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;

  constructor() {
    if (ContentScript.instance) {
      return ContentScript.instance;
    }

    ContentScript.instance = this;
    this.init();
  }

  private init(): void {
    this.setupMessageListener();
    this.setupKeyboardListener();
    this.setupSpeechRecognition();
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
          throw new Error(`Unknown action: ${(request as any).action}`);
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

  private setupKeyboardListener(): void {
    document.addEventListener('keydown', (event) => {
      // Check for Command+Shift+Space (Mac) or Ctrl+Shift+Space (Windows/Linux)
      const isCommandOrCtrl = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;
      const isSpace = event.code === 'Space';

      if (isCommandOrCtrl && isShift && isSpace) {
        event.preventDefault(); // Prevent default behavior
        this.toggleSpeechRecording();
        this.printTracking();
      }
    });
  }

  private async printTracking(): Promise<void> {
    this.log('tracking');

    // Store stats in Chrome storage
    try {
      const result = await chrome.storage.local.get(['trackingStats']);
      const currentStats = result.trackingStats || { totalCount: 0, lastPress: 'Never' };

      const now = new Date();
      const timeString = now.toLocaleTimeString();

      const newStats = {
        totalCount: currentStats.totalCount + 1,
        lastPress: timeString
      };

      await chrome.storage.local.set({ trackingStats: newStats });

      // Notify popup if it's open
      try {
        await chrome.runtime.sendMessage({ action: 'trackingUpdate' });
      } catch (error) {
        // Popup might not be open, that's fine
      }

      // Note: Slack messages are now sent when speech is transcribed, not on every keypress
    } catch (error) {
      console.error('Error updating tracking stats:', error);
    }
  }

  private setupSpeechRecognition(): void {
    // Check if speech recognition is supported
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.log('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();

    if (this.recognition) {
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.log('Speech recognition started');
        this.isRecording = true;
        this.showRecordingIndicator();
      };

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = '';
        let isFinal = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          transcript += result[0].transcript;
          if (result.isFinal) {
            isFinal = true;
          }
        }

        this.log('Speech recognition result:', { transcript, isFinal });
        this.updateTranscriptDisplay(transcript, isFinal);

        if (isFinal) {
          this.handleFinalTranscript(transcript);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.log('Speech recognition error:', event.error);
        this.isRecording = false;
        this.showErrorIndicator(`Speech recognition error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.log('Speech recognition ended');
        this.isRecording = false;
        this.hideRecordingIndicator();
      };

      this.log('Speech recognition setup complete');
    }
  }

  private toggleSpeechRecording(): void {
    if (!this.recognition) {
      this.showErrorIndicator('Speech recognition not available');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
      this.log('Stopping speech recognition');
    } else {
      try {
        this.recognition.start();
        this.log('Starting speech recognition');
      } catch (error) {
        this.log('Error starting speech recognition:', error);
        this.showErrorIndicator('Could not start speech recognition');
      }
    }
  }

  private showRecordingIndicator(): void {
    // Remove any existing indicator
    const existingIndicator = document.getElementById('unmute-recording-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create recording indicator
    const indicator = document.createElement('div');
    indicator.id = 'unmute-recording-indicator';
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="recording-dot"></div>
        <div class="recording-text">
          <div style="font-weight: bold; font-size: 16px;">🎤 Recording...</div>
          <div id="transcript-display" style="font-size: 14px; opacity: 0.8; margin-top: 4px;"></div>
        </div>
      </div>
    `;

    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      border: 2px solid #ff4444;
      backdrop-filter: blur(10px);
      max-width: 300px;
      word-wrap: break-word;
    `;

    // Add recording dot animation
    const style = document.createElement('style');
    style.textContent = `
      .recording-dot {
        width: 12px;
        height: 12px;
        background: #ff4444;
        border-radius: 50%;
        animation: recording-pulse 1s infinite;
      }
      @keyframes recording-pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(indicator);
  }

  private updateTranscriptDisplay(transcript: string, isFinal: boolean): void {
    const transcriptEl = document.getElementById('transcript-display');
    if (transcriptEl) {
      transcriptEl.textContent = transcript || 'Listening...';
      transcriptEl.style.opacity = isFinal ? '1' : '0.7';
      transcriptEl.style.fontStyle = isFinal ? 'normal' : 'italic';
    }
  }

  private async handleFinalTranscript(transcript: string): Promise<void> {
    this.log('=== CONTENT SCRIPT: FINAL TRANSCRIPT PROCESSING ===');
    this.log('Original transcript:', transcript);

    // Add laughter to the end of the transcript
    const modifiedTranscript = transcript;
    this.log('Modified transcript:', modifiedTranscript);
    this.log('Transcript length:', modifiedTranscript.length);

    // Generate TTS and save locally
    try {
      this.log('Sending message to background script...');
      const response = await chrome.runtime.sendMessage({
        action: 'generateTTSAndSaveLocally',
        text: modifiedTranscript
      });

      this.log('Response from background script:', response);

      if (response?.audioSaved) {
        this.log('SUCCESS: Audio file saved locally');
      } else {
        this.log('ERROR: Audio generation or save failed');
      }
    } catch (error) {
      this.log('ERROR: Exception in handleFinalTranscript');
      console.error('Error processing transcript:', error);
      this.log('Error name:', (error as Error).name);
      this.log('Error message:', (error as Error).message);
      this.log('Error stack:', (error as Error).stack);
    }

    // Show final result indicator
    setTimeout(() => {
      this.showTranscriptResult(transcript);
    }, 500);

    this.log('=== CONTENT SCRIPT: TRANSCRIPT PROCESSING COMPLETED ===');
  }

  private showTranscriptResult(transcript: string): void {
    // Remove recording indicator
    const recordingIndicator = document.getElementById('unmute-recording-indicator');
    if (recordingIndicator) {
      recordingIndicator.remove();
    }

    // Show final result
    const result = document.createElement('div');
    result.id = 'unmute-transcript-result';
    result.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold;">✅ Speech Recognized:</div>
      <div style="font-size: 14px; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px; word-wrap: break-word;">
        "${transcript}"
      </div>
    `;

    result.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 100, 0, 0.9);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0, 100, 0, 0.3);
      border: 2px solid #00ff00;
      backdrop-filter: blur(10px);
      max-width: 300px;
      word-wrap: break-word;
    `;

    document.body.appendChild(result);

    // Remove after 4 seconds
    setTimeout(() => {
      result.style.opacity = '0';
      result.style.transform = 'translateX(100%)';
      result.style.transition = 'all 0.3s ease';
      setTimeout(() => result.remove(), 300);
    }, 4000);
  }

  private showErrorIndicator(message: string): void {
    // Remove any existing indicators
    const existingIndicator = document.getElementById('unmute-recording-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    const error = document.createElement('div');
    error.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>❌</span>
        <span>${message}</span>
      </div>
    `;

    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(200, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(200, 0, 0, 0.3);
      backdrop-filter: blur(10px);
    `;

    document.body.appendChild(error);

    setTimeout(() => {
      error.style.opacity = '0';
      error.style.transition = 'opacity 0.3s ease';
      setTimeout(() => error.remove(), 300);
    }, 3000);
  }

  private hideRecordingIndicator(): void {
    const indicator = document.getElementById('unmute-recording-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.3s ease';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  private playAudio(audioUrl: string): void {
    try {
      const audio = new Audio(audioUrl);
      audio.volume = 0.8; // Set volume to 80%

      audio.onload = () => {
        this.log('Audio loaded successfully');
      };

      audio.onplay = () => {
        this.log('Audio playback started');
      };

      audio.onended = () => {
        this.log('Audio playback finished');
        // Clean up the blob URL to free memory
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play().catch(error => {
        console.error('Failed to play audio:', error);
        URL.revokeObjectURL(audioUrl);
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
    }
  }

  private base64ToBlob(base64Data: string, contentType: string): Blob {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  private log(message: string, ...args: unknown[]): void {
    console.log(`[Unmute Content Script] ${message}`, ...args);
  }
}

// Initialize the content script
new ContentScript();