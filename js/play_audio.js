class SpeechyPlayer {
    constructor() {
        this.reset();
    }

    reset() {
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.audio = null;
        this.queue = [];
        this.isProcessing = false;
        this.isInitialized = false;
        this.currentPlaybackId = null;
        this.hasStartedPlaying = false;
        this.totalBytesAppended = 0;
        this.initializationPromise = null;
    }

    async waitForSourceOpen(mediaSource) {
        if (mediaSource.readyState === 'open') return;
        
        await new Promise((resolve, reject) => {
            const handleOpen = () => {
                mediaSource.removeEventListener('sourceopen', handleOpen);
                mediaSource.removeEventListener('error', handleError);
                resolve();
            };
            
            const handleError = (error) => {
                mediaSource.removeEventListener('sourceopen', handleOpen);
                mediaSource.removeEventListener('error', handleError);
                reject(error);
            };

            mediaSource.addEventListener('sourceopen', handleOpen);
            mediaSource.addEventListener('error', handleError);
        });
    }

    async initialize(playbackId) {
        console.log('Initializing playback:', playbackId);
        
        this.providerType = playbackId.split('-')[0];
        console.log('Provider type:', this.providerType);
        
        // If already initializing, wait for it
        if (this.initializationPromise) {
            await this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            try {
                if (this.currentPlaybackId !== playbackId) {
                    await this.cleanup();
                }

                this.currentPlaybackId = playbackId;
                this.mediaSource = new MediaSource();
                this.audio = new Audio();
                
                // Configure audio
                this.audio.preload = 'auto';
                
                // Add event listeners
                this.audio.addEventListener('canplay', () => {
                    console.log('Audio canplay event');
                    this.checkAndPlay();
                });
                
                this.audio.addEventListener('loadeddata', () => {
                    console.log('Audio loadeddata event');
                    this.checkAndPlay();
                });

                this.audio.addEventListener('play', () => {
                    console.log('Audio play event');
                    this.hasStartedPlaying = true;
                });

                this.audio.addEventListener('playing', () => console.log('Audio playing event'));
                this.audio.addEventListener('waiting', () => console.log('Audio waiting event'));
                this.audio.addEventListener('error', (e) => console.error('Audio error:', this.audio.error));

                // Create and set source
                const url = URL.createObjectURL(this.mediaSource);
                console.log('Created URL:', url);
                this.audio.src = url;

                // Wait for source to open
                await this.waitForSourceOpen(this.mediaSource);
                console.log('MediaSource opened');
                
                this.isInitialized = true;
            } catch (error) {
                console.error('Initialization error:', error);
                throw error;
            }
        })();

        await this.initializationPromise;
        this.initializationPromise = null;
    }

    async checkAndPlay() {
        if (!this.audio || this.hasStartedPlaying || this.audio.readyState < 2) return;

        try {
            console.log('Attempting playback:', {
                readyState: this.audio.readyState,
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
                bytesAppended: this.totalBytesAppended
            });

            await this.audio.play();
            console.log('Playback started successfully');
        } catch (error) {
            console.warn('Playback attempt failed:', error);
            // Schedule retry if we have enough data
            if (this.totalBytesAppended > 32768) {
                setTimeout(() => this.checkAndPlay(), 100);
            }
        }
    }

    async appendChunk(chunk, isLastChunk = false, playbackId) {
        try {
            if (!this.isInitialized || this.currentPlaybackId !== playbackId) {
                await this.initialize(playbackId);
            }

            if (!this.sourceBuffer && this.mediaSource.readyState === 'open') {
                const mimeType = 'audio/mpeg';
                console.log('Creating sourceBuffer with mimeType:', mimeType);
                
                this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
                this.sourceBuffer.addEventListener('updateend', () => {
                    console.log('SourceBuffer updateend event');
                    if (!this.isProcessing) {
                        this.processQueue();
                    }
                    // Try to play after appending data
                    this.checkAndPlay();
                });
            }

            this.queue.push({ chunk, isLastChunk });
            await this.processQueue();

        } catch (error) {
            console.error('Error in appendChunk:', error);
            throw error;
        }
    }

    async processQueue() {
        if (this.isProcessing || !this.sourceBuffer || !this.queue.length) return;

        this.isProcessing = true;
        const errors = [];

        try {
            while (this.queue.length > 0) {
                const { chunk, isLastChunk } = this.queue[0];

                if (this.sourceBuffer.updating) {
                    await new Promise(resolve => {
                        this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                    });
                }

                this.queue.shift();
                const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                
                try {
                    this.sourceBuffer.appendBuffer(data);
                    this.totalBytesAppended += data.length;
                    
                    await new Promise((resolve, reject) => {
                        const handleUpdate = () => {
                            this.sourceBuffer.removeEventListener('updateend', handleUpdate);
                            this.sourceBuffer.removeEventListener('error', handleError);
                            resolve();
                        };
                        
                        const handleError = (event) => {
                            this.sourceBuffer.removeEventListener('updateend', handleUpdate);
                            this.sourceBuffer.removeEventListener('error', handleError);
                            reject(event);
                        };
                        
                        this.sourceBuffer.addEventListener('updateend', handleUpdate);
                        this.sourceBuffer.addEventListener('error', handleError);
                    });

                    if (isLastChunk && this.mediaSource.readyState === 'open') {
                        this.mediaSource.endOfStream();
                    }
                } catch (error) {
                    errors.push(error);
                    console.error('Error processing chunk:', error);
                }
            }
        } finally {
            this.isProcessing = false;
            if (errors.length > 0) {
                throw new Error('Errors occurred while processing queue');
            }
        }
    }

    async cleanup() {
        console.log('Starting cleanup');
        
        if (this.audio) {
            try {
                this.audio.pause();
                this.audio.currentTime = 0;
                
                if (this.audio.src) {
                    URL.revokeObjectURL(this.audio.src);
                    this.audio.removeAttribute('src');
                }
                
                // Wait for the audio element to fully reset
                await new Promise(resolve => {
                    const handleEmptied = () => {
                        this.audio.removeEventListener('emptied', handleEmptied);
                        resolve();
                    };
                    this.audio.addEventListener('emptied', handleEmptied);
                    this.audio.load();
                });
            } catch (error) {
                console.error('Error cleaning up audio:', error);
            }
        }

        this.reset();
        console.log('Cleanup completed');
    }
}

// Create global instance
window.speechyPlayer = new SpeechyPlayer();

// Message handling
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "play_audio") {
        try {
            const playbackId = message.playbackId || Date.now().toString();
            const chunk = new Uint8Array(message.audioData);
            const isLastChunk = message.isLastChunk || false;
            
            await window.speechyPlayer.appendChunk(chunk, isLastChunk, playbackId);
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error handling audio message:', error);
            await window.speechyPlayer.cleanup();
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

chrome.runtime.sendMessage({ action: "content_script_ready" });
