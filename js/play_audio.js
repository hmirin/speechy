// play_audio.js
console.log('Speechy audio player initialized');

class SpeechyPlayer {
    constructor() {
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.audio = null;
        this.queue = [];
        this.isProcessing = false;
        this.mimeType = null;
        this.chunks = [];
    }

    initialize() {
        // Clean up any previous instance
        this.cleanup();

        // Create new Audio element
        this.audio = new Audio();
        
        return this.audio;
    }

    async appendChunk(chunk) {
        // Store chunk
        this.chunks.push(chunk);
        
        // If this is the first chunk, determine if we should use MSE or direct playback
        if (this.chunks.length === 1) {
            // Try to determine format
            const format = this.determineFormat(chunk);
            console.log('Detected format:', format);
            
            if (format === 'mp3') {
                this.mimeType = 'audio/mpeg';
            } else if (format === 'wav') {
                this.mimeType = 'audio/wav';
            }

            // Check if MSE supports this format
            if (this.mimeType && MediaSource.isTypeSupported(this.mimeType)) {
                console.log('Using MSE with mime type:', this.mimeType);
                await this.initializeMSE();
            } else {
                console.log('Falling back to direct playback');
                await this.initializeDirectPlayback();
            }
        }

        // If using MSE, append to source buffer
        if (this.mediaSource && this.sourceBuffer) {
            await this.appendToSourceBuffer(chunk);
        }
        // Otherwise chunks are already stored and will be played directly
    }

    async initializeMSE() {
        return new Promise((resolve, reject) => {
            this.mediaSource = new MediaSource();
            this.audio.src = URL.createObjectURL(this.mediaSource);

            this.mediaSource.addEventListener('sourceopen', () => {
                try {
                    this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
                    this.sourceBuffer.addEventListener('updateend', () => {
                        this.processQueue();
                    });
                    resolve();
                } catch (error) {
                    console.error('Error in MSE initialization:', error);
                    this.fallbackToDirectPlayback();
                    resolve();
                }
            });

            this.mediaSource.addEventListener('error', (e) => {
                console.error('MediaSource error:', e);
                this.fallbackToDirectPlayback();
                resolve();
            });
        });
    }

    async initializeDirectPlayback() {
        // Combine all chunks we have so far
        const combinedChunks = new Blob(this.chunks, { type: this.mimeType || 'audio/mpeg' });
        this.audio.src = URL.createObjectURL(combinedChunks);
        
        // Start playing when we have enough data
        if (this.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            await this.audio.play();
        } else {
            this.audio.addEventListener('canplay', () => {
                this.audio.play().catch(console.error);
            });
        }
    }

    determineFormat(chunk) {
        // Check for MP3 header (first 11 bits should be 1)
        if (chunk[0] === 0xFF && (chunk[1] & 0xE0) === 0xE0) {
            return 'mp3';
        }
        
        // Check for WAV header ("RIFF" signature)
        if (chunk[0] === 0x52 && chunk[1] === 0x49 && 
            chunk[2] === 0x46 && chunk[3] === 0x46) {
            return 'wav';
        }
        
        // Default to MP3 if we can't determine
        return 'mp3';
    }

    async appendToSourceBuffer(chunk) {
        return new Promise((resolve) => {
            if (this.sourceBuffer.updating) {
                this.queue.push(chunk);
                resolve();
                return;
            }

            try {
                this.sourceBuffer.appendBuffer(chunk);
                
                // Start playing as soon as we have enough data
                if (this.audio.paused && 
                    this.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                    this.audio.play().catch(console.error);
                }
            } catch (error) {
                console.error('Error appending to SourceBuffer:', error);
                this.fallbackToDirectPlayback();
            }
            resolve();
        });
    }

    async processQueue() {
        if (this.queue.length > 0 && !this.sourceBuffer.updating) {
            const chunk = this.queue.shift();
            await this.appendToSourceBuffer(chunk);
        }
    }

    fallbackToDirectPlayback() {
        console.log('Falling back to direct playback');
        if (this.mediaSource) {
            if (this.audio.src) {
                URL.revokeObjectURL(this.audio.src);
            }
            this.mediaSource = null;
            this.sourceBuffer = null;
        }
        this.initializeDirectPlayback();
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
        this.chunks = [];
        this.mimeType = null;
    }
}

// Create global instance
window.speechyPlayer = new SpeechyPlayer();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.action);
    
    if (message.action === "play_audio") {
        try {
            // Initialize new audio player if this is the first chunk
            if (!window.speechyPlayer.audio) {
                window.speechyPlayer.initialize();
            }

            // Convert array to Uint8Array and append
            const chunk = new Uint8Array(message.audioData);
            window.speechyPlayer.appendChunk(chunk)
                .catch(error => {
                    console.error("Error appending audio chunk:", error);
                    sendResponse({ success: false, error: error.message });
                });

            // Send success response
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
