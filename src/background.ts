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
    this.log('Message listener setup completed');
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
    this.log('Setting up message listener...');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.log('=== MESSAGE RECEIVED ===');
      this.log('Action:', message?.action || 'NO ACTION');
      this.log('Message details:', message);

      (async () => {
        try {
          if (message.action === 'sendSlackMessage') {
            const messageText = message.message || '🎤 microphone triggered';
            await this.sendSlackNotification(messageText);
            sendResponse({ status: 'success' });
          } else if (message.action === 'generateTTSAndSaveLocally') {
            this.log('Processing generateTTSAndSaveLocally request...');
            this.log('Text to convert:', message.text);
            const success = await this.generateTTSAndSaveLocally(message.text);
            this.log('TTS generation and save result:', success);
            sendResponse({ status: 'success', audioSaved: success });
          } else if (message.action === 'sendSlackAudio') {
            await this.sendSlackAudio(message.audioData, message.filename, message.message);
            sendResponse({ status: 'success' });
          } else {
            this.log('Unknown action received:', message.action);
            sendResponse({ status: 'error', message: 'Unknown action' });
          }
        } catch (error) {
          this.log('Error in message handler:', error);
          sendResponse({ status: 'error', message: 'Handler error' });
        }
        this.log('=== MESSAGE PROCESSING COMPLETED ===');
      })();

      return true; // Indicates we will send a response asynchronously
    });
  }

  private async sendSlackNotification(messageText: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.log('Slack not configured, skipping notification');
        return;
      }

      this.log('Sending Slack notification to channel:', config.channelId);
      this.log('Message content:', messageText);

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channelId,
          text: messageText
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

  private async generateTTSAndSaveLocally(text: string): Promise<boolean> {
    try {
      this.log('=== STARTING TTS GENERATION PROCESS ===');
      this.log('Input text:', text);
      this.log('Text length:', text.length);

      const result = await chrome.storage.local.get(['fishConfig']);
      this.log('Storage result:', result);
      const config = result.fishConfig;
      this.log('Fish config loaded:', config ? 'Yes' : 'No');

      if (!config || !config.apiKey || !config.voiceId) {
        this.log('ERROR: Fish TTS not configured, skipping TTS generation');
        this.log('Config details - apiKey present:', !!config?.apiKey);
        this.log('Config details - voiceId present:', !!config?.voiceId);
        return false;
      }

      this.log('Fish API Key (first 10 chars):', config.apiKey.substring(0, 10) + '...');
      this.log('Voice ID:', config.voiceId);
      this.log('Making API request to Fish TTS...');

      const requestBody = {
        text: text,
        reference_id: config.voiceId,
        format: 'mp3'
      };
      this.log('Request body:', requestBody);

      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'model': 'speech-1.5'
        },
        body: JSON.stringify(requestBody)
      });

      this.log('Fish API response status:', response.status);
      this.log('Fish API response headers:', response.headers.get('content-type'));

      if (response.ok) {
        this.log('Fish API response successful, getting blob...');
        const audioBlob = await response.blob();
        this.log('Audio blob size:', audioBlob.size, 'bytes');
        this.log('Audio blob type:', audioBlob.type);

        // Generate filename with timestamp
        const timestamp = Date.now();
        const filename = `voice_note_${timestamp}.mp3`;
        const fullPath = `unmute/audio/${filename}`;
        this.log('Generated filename:', filename);
        this.log('Full path:', fullPath);

        // Save to downloads/unmute/audio directory
        await this.saveAudioToDownloads(audioBlob, fullPath);

        // Also send to Slack with SpongeBob image
        this.log('Sending audio and SpongeBob image to Slack...');
        const message = `🎤 Voice note: "${text}"`;
        await this.sendSlackAudioAndImage(audioBlob, filename, message);

        this.log('=== TTS GENERATION PROCESS COMPLETED SUCCESSFULLY ===');
        return true;
      } else {
        this.log('ERROR: Fish TTS API error');
        this.log('Status:', response.status);
        this.log('Status text:', response.statusText);

        try {
          const errorText = await response.text();
          this.log('Error response body:', errorText);
        } catch (e) {
          this.log('Could not read error response body');
        }

        return false;
      }
    } catch (error) {
      this.log('ERROR: Exception in generateTTSAndSaveLocally');
      console.error('Error generating TTS:', error);
      this.log('Error name:', (error as Error).name);
      this.log('Error message:', (error as Error).message);
      this.log('Error stack:', (error as Error).stack);
      return false;
    }
  }

  private async saveAudioToDownloads(audioBlob: Blob, fullPath: string): Promise<void> {
    try {
      this.log('=== STARTING FILE SAVE PROCESS ===');
      this.log('Blob size:', audioBlob.size);
      this.log('Full path:', fullPath);

      // Convert blob to data URL for download (service worker compatible)
      this.log('Converting blob to data URL...');
      const dataUrl = await this.blobToDataUrl(audioBlob);
      this.log('Data URL created, length:', dataUrl.length);

      // Trigger download using Chrome downloads API
      this.log('Initiating download...');
      chrome.downloads.download({
        url: dataUrl,
        filename: fullPath,
        saveAs: false
      }, (downloadId) => {
        this.log('Download initiated with ID:', downloadId);
        if (chrome.runtime.lastError) {
          this.log('Download error:', chrome.runtime.lastError.message);
        } else {
          this.log('Download started successfully');
          this.log('File should be saved to Downloads/' + fullPath);
        }
      });

      this.log('=== FILE SAVE PROCESS COMPLETED ===');
    } catch (error) {
      this.log('ERROR: Exception in saveAudioToDownloads');
      console.error('Error saving audio file:', error);
      this.log('Error name:', (error as Error).name);
      this.log('Error message:', (error as Error).message);
      this.log('Error stack:', (error as Error).stack);
    }
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/mpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async sendSlackAudioAndImage(audioBlob: Blob, filename: string, message: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.log('Slack not configured, skipping uploads');
        return;
      }

      this.log('Uploading audio and SpongeBob image to Slack...');

      // First, get SpongeBob image
      const spongebobUrl = chrome.runtime.getURL('images/spongebob.png');
      this.log('SpongeBob image URL:', spongebobUrl);

      let imageBlob: Blob | null = null;
      try {
        const imageResponse = await fetch(spongebobUrl);
        if (!imageResponse.ok) {
          throw new Error(`Image fetch failed: ${imageResponse.status}`);
        }
        imageBlob = await imageResponse.blob();
        this.log('SpongeBob image loaded, size:', imageBlob.size);
      } catch (imageError) {
        this.log('Failed to load SpongeBob image:', imageError);
        this.log('Proceeding with audio upload only');
      }

      // Upload audio first, then image
      if (imageBlob) {
        // Upload audio file first
        await this.uploadFileToSlack(audioBlob, filename, '', config);

        // Upload image with proper image display settings second
        await this.uploadImageToSlack(imageBlob, 'spongebob.png', config);

        this.log('Audio and image uploaded to Slack');
      } else {
        await this.uploadFileToSlack(audioBlob, filename, '', config);
        this.log('Audio uploaded to Slack successfully (image failed)');
      }
    } catch (error) {
      console.error('Error uploading files to Slack:', error);
    }
  }

  private async uploadMultipleFilesToSlack(files: Array<{blob: Blob, filename: string, comment: string}>, config: any): Promise<void> {
    try {
      this.log('Uploading multiple files to Slack together...');

      // Step 1: Get upload URLs for all files
      const uploadPromises = files.map(async (file) => {
        this.log('Getting upload URL for:', file.filename);
        const response = await fetch('https://slack.com/api/files.getUploadURLExternal', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.userToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            filename: file.filename,
            length: file.blob.size.toString()
          })
        });

        const data = await response.json();
        if (!data.ok) {
          throw new Error(`Failed to get upload URL for ${file.filename}: ${data.error}`);
        }

        return { ...file, uploadData: data };
      });

      const fileUploadData = await Promise.all(uploadPromises);
      this.log('Got upload URLs for all files');

      // Step 2: Upload all files to their URLs
      const uploadFilePromises = fileUploadData.map(async (fileData) => {
        this.log('Uploading file:', fileData.filename);
        const response = await fetch(fileData.uploadData.upload_url, {
          method: 'POST',
          body: fileData.blob
        });

        if (!response.ok) {
          throw new Error(`File upload failed for ${fileData.filename}: ${response.status}`);
        }

        return fileData;
      });

      await Promise.all(uploadFilePromises);
      this.log('All files uploaded successfully');

      // Step 3: Complete the upload with all files in one message
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileUploadData.map(fileData => ({
            id: fileData.uploadData.file_id,
            title: fileData.filename
          })),
          channel_id: config.channelId
        })
      });

      const completeData = await completeResponse.json();
      this.log('Complete upload response:', completeData);

      if (completeData.ok) {
        this.log('All files shared to Slack successfully in one message');
      } else {
        console.error('Failed to complete multi-file upload:', completeData.error);
      }
    } catch (error) {
      console.error('Error uploading multiple files to Slack:', error);
    }
  }

  private async uploadImageToSlack(imageBlob: Blob, filename: string, config: any): Promise<void> {
    try {
      this.log('Uploading image for inline display to Slack:', filename);

      // Step 1: Get upload URL for image
      const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          filename: filename,
          length: imageBlob.size.toString()
        })
      });

      const uploadData = await uploadUrlResponse.json();
      if (!uploadData.ok) {
        console.error('Failed to get upload URL for image:', uploadData.error);
        return;
      }

      // Step 2: Upload image
      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'POST',
        body: imageBlob
      });

      if (!uploadResponse.ok) {
        console.error('Image upload failed:', uploadResponse.status, uploadResponse.statusText);
        return;
      }

      // Step 3: Complete upload with image display settings
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            id: uploadData.file_id,
            title: filename
          }],
          channel_id: config.channelId
        })
      });

      const completeData = await completeResponse.json();
      if (completeData.ok) {
        this.log('Image uploaded successfully for display');
      } else {
        console.error('Failed to complete image upload:', completeData.error);
      }
    } catch (error) {
      console.error('Error uploading image to Slack:', error);
    }
  }

  private async uploadFileToSlack(fileBlob: Blob, filename: string, message: string, config: any): Promise<void> {
    try {
      this.log('Uploading file to Slack:', filename);

      // Step 1: Get upload URL
      this.log('Step 1: Getting upload URL for', filename);
      const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          filename: filename,
          length: fileBlob.size.toString()
        })
      });

      const uploadData = await uploadUrlResponse.json();
      this.log('Upload URL response for', filename, ':', uploadData);

      if (!uploadData.ok) {
        console.error('Failed to get upload URL for', filename, ':', uploadData.error);
        return;
      }

      // Step 2: Upload file to the URL
      this.log('Step 2: Uploading', filename, 'to:', uploadData.upload_url);
      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'POST',
        body: fileBlob
      });

      if (!uploadResponse.ok) {
        console.error('File upload failed for', filename, ':', uploadResponse.status, uploadResponse.statusText);
        return;
      }

      // Step 3: Complete the upload
      this.log('Step 3: Completing upload for', filename);
      const requestBody: any = {
        files: [{
          id: uploadData.file_id,
          title: filename
        }],
        channel_id: config.channelId
      };

      // Only add initial_comment if message is not empty
      if (message && message.trim()) {
        requestBody.initial_comment = message;
      }

      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const completeData = await completeResponse.json();
      this.log('Complete upload response for', filename, ':', completeData);

      if (completeData.ok) {
        this.log('File uploaded successfully:', filename);
      } else {
        console.error('Failed to complete upload for', filename, ':', completeData.error);
      }
    } catch (error) {
      console.error('Error uploading', filename, 'to Slack:', error);
    }
  }

  private async sendSlackAudioBlob(audioBlob: Blob, filename: string, message: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.log('Slack not configured, skipping audio upload');
        return;
      }

      this.log('Uploading audio file to Slack using new API:', filename);

      // Step 1: Get upload URL
      this.log('Step 1: Getting upload URL...');
      const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          filename: filename,
          length: audioBlob.size.toString()
        })
      });

      const uploadData = await uploadUrlResponse.json();
      this.log('Upload URL response:', uploadData);

      if (!uploadData.ok) {
        console.error('Failed to get upload URL:', uploadData.error);
        return;
      }

      // Step 2: Upload file to the URL
      this.log('Step 2: Uploading file to:', uploadData.upload_url);
      const uploadResponse = await fetch(uploadData.upload_url, {
        method: 'POST',
        body: audioBlob
      });

      if (!uploadResponse.ok) {
        console.error('File upload failed:', uploadResponse.status, uploadResponse.statusText);
        return;
      }

      // Step 3: Complete the upload
      this.log('Step 3: Completing upload...');
      const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            id: uploadData.file_id,
            title: filename
          }],
          channel_id: config.channelId,
          initial_comment: message
        })
      });

      const completeData = await completeResponse.json();
      this.log('Complete upload response:', completeData);

      if (completeData.ok) {
        this.log('Audio file uploaded to Slack successfully');
      } else {
        console.error('Failed to complete upload:', completeData.error);
      }
    } catch (error) {
      console.error('Error uploading audio to Slack:', error);
    }
  }

  private async sendSlackAudio(audioData: string, filename: string, message: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['slackConfig']);
      const config = result.slackConfig;

      if (!config || !config.channelId || !config.userToken) {
        this.log('Slack not configured, skipping audio upload');
        return;
      }

      this.log('Uploading audio file to Slack:', filename);

      // Convert base64 back to blob
      const audioBlob = this.base64ToBlob(audioData, 'audio/mpeg');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', audioBlob, filename);
      formData.append('channels', config.channelId);
      formData.append('initial_comment', message);
      formData.append('filetype', 'mp3');

      const response = await fetch('https://slack.com/api/files.upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.userToken}`,
        },
        body: formData
      });

      const data = await response.json();
      this.log('Slack file upload response:', data);

      if (data.ok) {
        this.log('Audio file uploaded to Slack successfully');
      } else {
        console.error('Slack file upload error:', data.error);
      }
    } catch (error) {
      console.error('Error uploading audio to Slack:', error);
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
    console.log(`[Unmute Background] ${message}`, ...args);
  }
}

// Initialize the background service
new BackgroundService();