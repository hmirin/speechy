// play_audio.js
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
        this.playAttempts = 0;
    }

    async initialize(playbackId) {
        console.log('Initializing playback:', playbackId);
        
        this.providerType = playbackId.split('-')[0];
        console.log('Provider type:', this.providerType);
        
        if (this.currentPlaybackId !== playbackId) {
            console.log('New playback ID, cleaning up previous playback');
            await this.cleanup();
        }

        return new Promise((resolve, reject) => {
            try {
                this.currentPlaybackId = playbackId;
                this.mediaSource = new MediaSource();
                this.audio = new Audio();
                
                // Set audio properties
                this.audio.autoplay = true;
                this.audio.preload = 'auto';
                
                // Add event listeners
                this.audio.addEventListener('loadstart', () => console.log('Audio loadstart'));
                this.audio.addEventListener('loadeddata', () => console.log('Audio loadeddata'));
                this.audio.addEventListener('canplay', () => {
                    console.log('Audio canplay event');
                    this.tryPlay();
                });
                this.audio.addEventListener('play', () => console.log('Audio play event'));
                this.audio.addEventListener('playing', () => {
                    console.log('Audio playing event');
                    this.hasStartedPlaying = true;
                });
                this.audio.addEventListener('waiting', () => console.log('Audio waiting'));
                this.audio.addEventListener('error', (e) => {
                    console.error('Audio error:', this.audio.error);
                });

                // Add state change logging
                this.audio.addEventListener('readystatechange', () => {
                    console.log('Audio readyState:', this.audio.readyState);
                });
                
                const handleSourceOpen = () => {
                    console.log('MediaSource opened');
                    this.isInitialized = true;
                    this.mediaSource.removeEventListener('sourceopen', handleSourceOpen);
                    resolve();
                };

                this.mediaSource.addEventListener('sourceopen', handleSourceOpen);
                const url = URL.createObjectURL(this.mediaSource);
                console.log('Created URL:', url);
                this.audio.src = url;
            } catch (error) {
                console.error('Initialization error:', error);
                reject(error);
            }
        });
    }

    async tryPlay() {
        if (!this.audio || this.hasStartedPlaying) return;
        
        if (this.playAttempts >= 5) {
            console.log('Maximum play attempts reached, resetting');
            this.playAttempts = 0;
            return;
        }

        this.playAttempts++;
        
        try {
            console.log('Attempting playback:', {
                readyState: this.audio.readyState,
                buffered: this.formatTimeRanges(this.audio.buffered),
                attempt: this.playAttempts,
                bytesAppended: this.totalBytesAppended
            });
            
            await this.audio.play();
            console.log('Playback started successfully');
            this.hasStartedPlaying = true;
        } catch (error) {
            console.error('Playback attempt failed:', error);
            // Retry after a delay if we have enough data
            if (this.totalBytesAppended > 32768) {
                setTimeout(() => this.tryPlay(), 500);
            }
        }
    }

    formatTimeRanges(timeRanges) {
        const ranges = [];
        for (let i = 0; i < timeRanges.length; i++) {
            ranges.push([timeRanges.start(i), timeRanges.end(i)]);
        }
        return ranges;
    }

    async appendChunk(chunk, isLastChunk = false, playbackId) {
        console.log('Appending chunk:', {
            isLastChunk,
            playbackId,
            chunkSize: chunk.length,
            totalBytes: this.totalBytesAppended
        });
        
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
                    // Try to play after enough data is buffered
                    if (this.totalBytesAppended > 32768 && !this.hasStartedPlaying) {
                        this.tryPlay();
                    }
                    if (!this.isProcessing) {
                        this.processQueue();
                    }
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
        if (this.isProcessing || !this.sourceBuffer || !this.queue.length) {
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

                const { chunk, isLastChunk } = this.queue.shift();
                const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
                
                this.sourceBuffer.appendBuffer(data);
                this.totalBytesAppended += data.length;
                
                // Try to play after accumulating enough data
                if (this.totalBytesAppended > 32768 && !this.hasStartedPlaying) {
                    await this.tryPlay();
                }

                await new Promise(resolve => {
                    this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                });

                if (isLastChunk && !this.sourceBuffer.updating) {
                    console.log('Processing last chunk, ending stream');
                    try {
                        this.mediaSource.endOfStream();
                    } catch (error) {
                        console.error('Error ending stream:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in processQueue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    async cleanup() {
        console.log('Starting cleanup');
        
        if (this.audio) {
            try {
                await this.audio.pause();
                this.audio.currentTime = 0;
                if (this.audio.src) {
                    URL.revokeObjectURL(this.audio.src);
                    this.audio.removeAttribute('src');
                    this.audio.load();
                }
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
