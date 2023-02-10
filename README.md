# PagePilot

PagePilot is a Chrome Extension that will Summarize the content of the current webpage you are on and will read the summary out loud to you.

This extension utilizes the [Kagi Universal Summarizer](https://labs.kagi.com/ai/sum) API to summarize the content of the webpage.

The text to speech is powered by `chrome.tts` [API](https://developer.chrome.com/docs/extensions/reference/tts/)

## Installation

Since this extension is not yet published on the Chrome Web Store, you will need to install it manually.

This can be done by following these steps:

1. Clone/download this repository
2. Go to `chrome://extensions/`
3. Click on `Load Unpacked`
4. Select the `extension` folder in this repository and click `Open`
5. You should now see the extension in your list of extensions
6. Click on the extension name in the list of extensions
7. Select the voice you want to use and the speed by clicking the `Sample` button

## Usage

Hit the summarize button on the extension popup to summarize the current webpage and it will read the summary out loud to you.

## TODOS

[x] Highlight each word as the TTS speaks it (partially done)
[] Styling the extension
[] Poll the summary status in background and alert when summary is ready
[] Add build pipeline
