importScripts("config.js");

class TTSProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async synthesize(text, options) {
    throw new Error("Method not implemented");
  }

  static showError(message) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "/images/icon128.png",
      title: "Speechy",
      message,
    });
  }

  async synthesizeStream(text, options) {
    throw new Error("Method not implemented");
  }
}

class GoogleTTSProvider extends TTSProvider {
  // Helper to create WAV header
  createWavHeader(dataLength) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // "RIFF" chunk descriptor
    view.setUint8(0, 0x52); // R
    view.setUint8(1, 0x49); // I
    view.setUint8(2, 0x46); // F
    view.setUint8(3, 0x46); // F
    view.setUint32(4, 36 + dataLength, true); // Chunk size
    view.setUint8(8, 0x57); // W
    view.setUint8(9, 0x41); // A
    view.setUint8(10, 0x56); // V
    view.setUint8(11, 0x45); // E

    // "fmt " sub-chunk
    view.setUint8(12, 0x66); // f
    view.setUint8(13, 0x6d); // m
    view.setUint8(14, 0x74); // t
    view.setUint8(15, 0x20); // " "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for mono)
    view.setUint32(24, 24000, true); // SampleRate (24kHz for Google TTS)
    view.setUint32(28, 48000, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // "data" sub-chunk
    view.setUint8(36, 0x64); // d
    view.setUint8(37, 0x61); // a
    view.setUint8(38, 0x74); // t
    view.setUint8(39, 0x61); // a
    view.setUint32(40, dataLength, true); // Subchunk2Size

    return new Uint8Array(buffer);
  }

  async synthesizeStream(text, options) {
    const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${this.apiKey}`;
    const language = options.voice.split("-").slice(0, 2).join("-");
    const speed = options.speed || 1;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          input: { text: text },
          voice: { name: options.voice, languageCode: language },
          audioConfig: {
            audioEncoding: "LINEAR16",
            speakingRate: speed,
            sampleRateHertz: 24000,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        TTSProvider.showError(
          `Error from Google Cloud Text-to-Speech API\nCode: ${error.error.code}\nMessage: ${error.error.message}`,
        );
        throw error;
      }

      const json = await response.json();

      // Convert base64 to binary data
      const binaryString = atob(json.audioContent);
      const dataLength = binaryString.length;
      const audioData = new Uint8Array(dataLength);
      for (let i = 0; i < dataLength; i++) {
        audioData[i] = binaryString.charCodeAt(i);
      }

      // Create WAV header
      const wavHeader = this.createWavHeader(dataLength);

      // Create a ReadableStream that yields the WAV data in chunks
      return new ReadableStream({
        start(controller) {
          // First, send the WAV header as a separate chunk
          controller.enqueue(wavHeader);

          // Then send the audio data in chunks
          const chunkSize = 32 * 1024; // 32KB chunks
          for (let offset = 0; offset < audioData.length; offset += chunkSize) {
            const end = Math.min(offset + chunkSize, audioData.length);
            const chunk = audioData.slice(offset, end);
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
    } catch (error) {
      console.error("Google TTS Error:", error);
      throw error;
    }
  }
}

class OpenAITTSProvider extends TTSProvider {
  async synthesizeStream(text, options) {
    const endpoint = "https://api.openai.com/v1/audio/speech";
    const { voice = "alloy", model = "tts-1" } = options;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        TTSProvider.showError(
          `Error from OpenAI Text-to-Speech API\nMessage: ${error.message}`,
        );
        throw error;
      }

      return response.body;
    } catch (error) {
      console.error("OpenAI TTS Error:", error);
      throw error;
    }
  }
}

class SpeechyService {
  static ERROR_MESSAGE = SPEECHY_CONFIG.ERROR_MESSAGE;
  static DEFAULT_OPTIONS = SPEECHY_CONFIG.DEFAULT_OPTIONS;

  static async initialize() {
    chrome.contextMenus.create({
      id: "readBySpeechy",
      title: "Read this by Speechy",
      contexts: ["selection"],
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "readBySpeechy") {
        this.handleReadText();
      }
    });

    chrome.commands.onCommand.addListener((command) => {
      if (command === "read_the_selected_text") {
        this.handleReadText();
      }
    });

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install" || details.reason === "update") {
        chrome.tabs.create({
          url: "https://hmirin.github.io/speechy/installed",
        });
      }
    });
  }

  static async getSelectedText() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return null;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id, allFrames: true },
      function: () => {
        const activeEl = document.activeElement;
        const activeElTagName = activeEl
          ? activeEl.tagName.toLowerCase()
          : null;

        if (
          activeElTagName == "textarea" ||
          (activeElTagName == "input" &&
            /^(?:text|search|password|tel|url)$/i.test(activeEl.type) &&
            typeof activeEl.selectionStart == "number")
        ) {
          return activeEl.value.slice(
            activeEl.selectionStart,
            activeEl.selectionEnd,
          );
        }
        return window.getSelection().toString();
      },
    });

    if (!results || results.length === 0) return null;

    return results.reduce((sum, value) => value.result || sum, "");
  }

  static async getOptions() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.DEFAULT_OPTIONS, (items) => {
        // Handle migration from deprecated options
        if (items.chosen_provider_options !== undefined) {
          const { api_key, speed, voice } = items.chosen_provider_options;
          if (api_key !== undefined) items.google_apikey = api_key;
          if (speed !== undefined) items.google_speed = speed;
          if (voice !== undefined) items.google_voice = voice;
          items.chosen_provider_options = {};
          chrome.storage.sync.set(items);
        }
        resolve(items);
      });
    });
  }

  static createTTSProvider(options) {
    switch (options.api_provider) {
      case "Google":
        return new GoogleTTSProvider(options.google_apikey);
      case "OpenAI":
        return new OpenAITTSProvider(options.openai_apikey);
      default:
        return null;
    }
  }

  static async handleReadText() {
    try {
      // Get active tab first
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        console.error("No active tab found");
        return;
      }

      // Inject the content script first if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.speechyPlayer !== undefined,
        });
      } catch {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/play_audio.js"],
        });
      }

      // Get the selected text
      const selectedText = await this.getSelectedText();
      if (!selectedText) {
        TTSProvider.showError(this.ERROR_MESSAGE);
        return;
      }

      const options = await this.getOptions();
      const provider = this.createTTSProvider(options);

      if (!provider) {
        TTSProvider.showError(
          "Please select an API provider and setup your API key.",
        );
        return;
      }

      const providerOptions =
        options.api_provider === "Google"
          ? { voice: options.google_voice, speed: options.google_speed }
          : { voice: options.openai_voice, model: options.openai_model };

      // Generate a unique playback ID that includes the provider and voice
      const playbackId = `${options.api_provider}-${providerOptions.voice}-${Date.now()}`;

      // Get the stream
      const stream = await provider.synthesizeStream(
        selectedText,
        providerOptions,
      );

      // Create a reader to process the stream
      const reader = stream.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Send the last chunk with isLastChunk flag
          if (chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1];
            await chrome.tabs.sendMessage(tab.id, {
              action: "play_audio",
              audioData: Array.from(lastChunk),
              isLastChunk: true,
              playbackId,
            });
          }
          break;
        }

        chunks.push(value);

        // Send current chunk
        await chrome.tabs.sendMessage(tab.id, {
          action: "play_audio",
          audioData: Array.from(value),
          isLastChunk: false,
          playbackId,
        });
      }
    } catch (error) {
      console.error("Error in handleReadText:", error);
      TTSProvider.showError("An error occurred while processing your request.");
    }
  }
}

// Initialize the service
SpeechyService.initialize();
