// play_audio.js
class SpeechyPlayer {
    constructor() {
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.audio = null;
        this.queue = [];
        this.isProcessing = false;
        this.isInitialized = false;
        this.endOfStreamReceived = false;
    }

    async initialize() {
        // Clean up any previous instance
        this.cleanup();

        // Create new MediaSource instance
        this.mediaSource = new MediaSource();
        this.audio = new Audio();
        this.audio.src = URL.createObjectURL(this.mediaSource);
        
        await new Promise((resolve) => {
            this.mediaSource.addEventListener('sourceopen', () => {
                this.isInitialized = true;
                resolve();
            }, { once: true });
        });
    }

    async appendChunk(chunk, isLastChunk = false) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // If no sourceBuffer, create one based on the chunk type
            if (!this.sourceBuffer) {
                const mimeType = this.determineFormat(chunk) === 'mp3' ? 'audio/mpeg' : 'audio/wav';
                this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
                
                // Add updateend event listener for queue processing
                this.sourceBuffer.addEventListener('updateend', () => {
                    this.processQueue();
                });
            }

            // Add chunk to queue
            this.queue.push(chunk);
            
            // Start processing if not already processing
            if (!this.isProcessing) {
                await this.processQueue();
            }

            // Handle last chunk
            if (isLastChunk && this.mediaSource.readyState === 'open') {
                await this.waitForQueueEmpty();
                this.mediaSource.endOfStream();
            }

            // Start playback if not already playing
            if (this.audio && this.audio.paused) {
                await this.audio.play();
            }

        } catch (error) {
            console.error('Error appending chunk:', error);
            throw error;
        }
    }

    async waitForQueueEmpty() {
        return new Promise(resolve => {
            const checkQueue = () => {
                if (this.queue.length === 0 && !this.sourceBuffer.updating) {
                    resolve();
                } else {
                    setTimeout(checkQueue, 100);
                }
            };
            checkQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || !this.sourceBuffer || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                if (this.sourceBuffer.updating) {
                    await new Promise(resolve => {
                        this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                    });
                }

                const chunk = this.queue.shift();
                await this.appendToSourceBuffer(chunk);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    determineFormat(chunk) {
        // Check for MP3 header (ID3 or MPEG frame sync)
        if ((chunk[0] === 0x49 && chunk[1] === 0x44 && chunk[2] === 0x33) || // ID3
            (chunk[0] === 0xFF && (chunk[1] & 0xE0) === 0xE0)) { // MPEG frame sync
            return 'mp3';
        }
        // Check for WAV header (RIFF)
        if (chunk[0] === 0x52 && chunk[1] === 0x49 && 
            chunk[2] === 0x46 && chunk[3] === 0x46) {
            return 'wav';
        }
        return 'mp3'; // Default to MP3
    }

    async appendToSourceBuffer(chunk) {
        try {
            if (chunk instanceof Uint8Array) {
                this.sourceBuffer.appendBuffer(chunk);
            } else {
                console.warn('Received non-Uint8Array chunk, converting...');
                this.sourceBuffer.appendBuffer(new Uint8Array(chunk));
            }
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                // Wait for more buffer space
                await new Promise(resolve => {
                    this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                });
                // Try again
                await this.appendToSourceBuffer(chunk);
            } else {
                console.error('Error in appendToSourceBuffer:', error);
                throw error;
            }
        }
    }

    cleanup() {
        if (this.audio) {
            this.audio.pause();
            if (this.audio.src) {
                URL.revokeObjectURL(this.audio.src);
            }
        }
        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            try {
                this.mediaSource.endOfStream();
            } catch (error) {
                console.error('Error ending media stream:', error);
            }
        }
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.audio = null;
        this.queue = [];
        this.isProcessing = false;
        this.isInitialized = false;
        this.endOfStreamReceived = false;
    }
}

// Create global instance
window.speechyPlayer = new SpeechyPlayer();

// Message handling
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('Received message:', message.action);
    
    if (message.action === "play_audio") {
        try {
            // Convert array to Uint8Array and append
            const chunk = new Uint8Array(message.audioData);
            const isLastChunk = message.isLastChunk || false;
            await window.speechyPlayer.appendChunk(chunk, isLastChunk);
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error handling audio message:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;  // Keep the message channel open for async response
    }
});

// Let background script know that content script is ready
chrome.runtime.sendMessage({ action: "content_script_ready" });
