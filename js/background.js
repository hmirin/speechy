importScripts('config.js');  

class TTSProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async synthesize(text, options) {
        throw new Error('Method not implemented');
    }

    static showError(message) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/icon128.png',
            title: 'Speechy',
            message
        });
    }

    async synthesizeStream(text, options) {
        throw new Error('Method not implemented');
    }
}

class GoogleTTSProvider extends TTSProvider {
    async synthesizeStream(text, options) {
        const endpoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${this.apiKey}`;
        const language = options.voice.split("-").slice(0, 2).join("-");
        const speed = options.speed || 1;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                body: JSON.stringify({
                    "input": { "text": text },
                    "voice": { "name": options.voice, "languageCode": language },
                    "audioConfig": { "audioEncoding": "LINEAR16", "speakingRate": speed }
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                this.showError(`Error from Google Cloud Text-to-Speech API\nCode: ${error.error.code}\nMessage: ${error.error.message}`);
                throw error;
            }

            const json = await response.json();
            // Convert base64 to stream
            const binaryString = atob(json.audioContent);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Create a ReadableStream from the audio data
            return new Response(bytes).body;
        } catch (error) {
            console.error('Google TTS Error:', error);
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
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ model, input: text, voice, response_format: "mp3" }),
            });

            if (!response.ok) {
                const error = await response.json();
                TTSProvider.showError(`Error from OpenAI Text-to-Speech API\nMessage: ${error.message}`);
                throw error;
            }

            return response.body;
        } catch (error) {
            console.error('OpenAI TTS Error:', error);
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
            contexts: ["selection"]
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
                chrome.tabs.create({ url: "https://hmirin.github.io/speechy/installed" });
            }
        });
    }

    static async getSelectedText() {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs.length === 0) return null;

        const results = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id, allFrames: true },
            function: () => {
                const activeEl = document.activeElement;
                const activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
                
                if ((activeElTagName == "textarea") || 
                    (activeElTagName == "input" && /^(?:text|search|password|tel|url)$/i.test(activeEl.type)) &&
                    (typeof activeEl.selectionStart == "number")) {
                    return activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
                }
                return window.getSelection().toString();
            },
        });

        if (!results || results.length === 0) return null;

        return results.reduce((sum, value) => value.result || sum, '');
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
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                console.error('No active tab found');
                return;
            }
    
            // Inject the content script first if needed
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => window.speechyPlayer !== undefined
                });
            } catch {
                // If the check fails or returns false, inject the script
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['js/play_audio.js']
                });
            }
    
            // Then get the selected text
            const selectedText = await this.getSelectedText();
            if (!selectedText) {
                TTSProvider.showError(this.ERROR_MESSAGE);
                return;
            }
    
            const options = await this.getOptions();
            const provider = this.createTTSProvider(options);
            
            if (!provider) {
                TTSProvider.showError("Please select an API provider and setup your API key.");
                return;
            }
    
            const providerOptions = options.api_provider === "Google" 
                ? { voice: options.google_voice, speed: options.google_speed }
                : { voice: options.openai_voice, model: options.openai_model };
    
            // Get the stream
            const stream = await provider.synthesizeStream(selectedText, providerOptions);
            
            // Read and send chunks
            const reader = stream.getReader();
            let chunkCounter = 0;
    
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
    
                // Convert chunk to array for message passing
                const chunkArray = Array.from(value);
    
                // Send chunk to content script
                await chrome.tabs.sendMessage(tab.id, {
                    action: "play_audio",
                    audioData: chunkArray,
                    chunkIndex: chunkCounter++
                });
            }
    
        } catch (error) {
            console.error('Error in handleReadText:', error);
            TTSProvider.showError("An error occurred while processing your request.");
        }
    }
}

// Initialize the service
SpeechyService.initialize();
