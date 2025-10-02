# SlackAttack

Ever had a passive aggressive coworker and wanted to know what they really thought? Yeah, us too, so we created SlackAttack.

## What it does

SlackAttack records your audio while you're on mute and sends them to your team's Slack channel in SpongeBob's voice.

## Features

- **Hotkey Speech Recognition**: Press `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows/Linux) to start/stop voice recording
- **Real-time Transcription**: Converts speech to text using the Web Speech API
- **SpongeBob Voice Generation**: Transforms your words into SpongeBob's voice using Fish Audio API
- **Automatic Slack Integration**: Posts audio files and SpongeBob images directly to your team's Slack channel
- **Local Storage**: Saves all audio files to `Downloads/unmute/audio/`
- **Visual Feedback**: Live recording indicators and transcript display

## How we built it

We developed a TypeScript-based Chrome extension that integrates hotkey detection with the Web Speech API for real-time speech-to-text transcription. The transcribed text is then processed through the Fish Audio API to generate audio in SpongeBob's distinctive voice. Finally, the generated audio file is automatically posted to Slack via the Slack API, completing the within seconds.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/mzhang055/unmute.git
   cd unmute
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## Configuration

### Slack Setup

1. Click the extension icon to open the popup
2. Enter your Slack Channel ID and User Token
3. Click "Save Configuration"
4. Test the connection with "Test Message"

**Required Slack Permissions:**
- `chat:write` - To send messages
- `files:write` - To upload audio files

### Fish TTS Setup

1. Get an API key from [Fish.audio](https://fish.audio)
2. Select SpongeBob's voice and note its Voice ID
3. Enter both in the extension popup
4. Click "Save Configuration"
5. Test with "Test TTS"

## Usage

1. **Start Recording**: Press `Cmd+Shift+Space` (Mac) or `Ctrl+Shift+Space` (Windows/Linux)
2. **Speak**: The extension shows a recording indicator with live transcript
3. **Stop Recording**: Press the keyboard shortcut again or stop speaking
4. **Automatic Magic**:
   - Your speech is transcribed to text
   - Text is converted to SpongeBob's voice via Fish TTS
   - Audio file is saved locally to your Downloads folder
   - Audio and SpongeBob image are posted to your Slack channel

## Development

### Project Structure

```
unmute/
├── src/
│   ├── background.ts    # Background service worker
│   ├── content.ts       # Content script for speech recognition
│   ├── popup.ts         # Popup UI controller
│   ├── types.ts         # TypeScript type definitions
│   └── types/
│       └── speech.d.ts  # Web Speech API types
├── dist/                # Built extension files
├── icons/              # Extension icons
├── images/             # Assets (SpongeBob image)
├── manifest.json       # Chrome extension manifest
└── webpack.config.js   # Build configuration
```

### Available Scripts

- `npm run dev` - Build in development mode with watch
- `npm run build` - Build production version
- `npm run clean` - Remove dist folder
- `npm run type-check` - Run TypeScript type checking


You're your own worst disaster.


## Built With

- TypeScript
- Fish Audio API
- Slack API
- Web Speech API

