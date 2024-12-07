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
    }

    async initialize(playbackId) {
        console.log('Initializing playback:', playbackId);
        
        if (this.currentPlaybackId !== playbackId) {
            console.log('New playback ID, cleaning up previous playback');
            await this.cleanup();
        }

        return new Promise((resolve, reject) => {
            try {
                this.currentPlaybackId = playbackId;
                this.mediaSource = new MediaSource();
                this.audio = new Audio();
                
                // Add event listeners
                this.audio.addEventListener('play', () => console.log('Audio play event fired'));
                this.audio.addEventListener('playing', () => console.log('Audio playing event fired'));
                this.audio.addEventListener('waiting', () => console.log('Audio waiting for more data'));
                this.audio.addEventListener('ended', () => console.log('Audio playback ended'));
                this.audio.addEventListener('error', (e) => console.error('Audio error:', e));
                
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

    async appendChunk(chunk, isLastChunk = false, playbackId) {
        console.log('Appending chunk, isLastChunk:', isLastChunk, 'playbackId:', playbackId);
        
        try {
            if (!this.isInitialized || this.currentPlaybackId !== playbackId) {
                await this.initialize(playbackId);
            }

            if (!this.sourceBuffer && this.mediaSource.readyState === 'open') {
                const mimeType = this.determineFormat(chunk) === 'mp3' ? 'audio/mpeg' : 'audio/wav';
                console.log('Creating sourceBuffer with mimeType:', mimeType);
                this.sourceBuffer = this.mediaSource.addSourceBuffer(mimeType);
                
                // Set up updateend handler
                this.sourceBuffer.addEventListener('updateend', () => {
                    console.log('SourceBuffer updateend event');
                    this.processQueue();
                });
            }

            // Add to queue and process
            this.queue.push({ chunk, isLastChunk });
            console.log('Chunk added to queue. Queue length:', this.queue.length);
            
            await this.processQueue();

        } catch (error) {
            console.error('Error in appendChunk:', error);
            throw error;
        }
    }

    async processQueue() {
        if (this.isProcessing || !this.sourceBuffer) {
            console.log('Queue processing skipped - already processing or no sourceBuffer');
            return;
        }

        if (this.queue.length === 0) {
            console.log('Queue processing skipped - queue empty');
            return;
        }

        this.isProcessing = true;
        console.log('Starting queue processing');

        try {
            while (this.queue.length > 0) {
                // If sourceBuffer is updating, wait for it to finish
                if (this.sourceBuffer.updating) {
                    console.log('Waiting for sourceBuffer update to complete');
                    await new Promise(resolve => {
                        this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                    });
                }

                const { chunk, isLastChunk } = this.queue[0];
                this.queue.shift();

                // Append the chunk
                await this.appendToSourceBuffer(chunk);

                // Try to start/resume playback
                if (!this.hasStartedPlaying && this.audio.readyState >= 2) {
                    console.log('Starting playback...');
                    try {
                        await this.audio.play();
                        this.hasStartedPlaying = true;
                    } catch (error) {
                        console.error('Playback failed:', error);
                    }
                }

                // Handle last chunk
                if (isLastChunk && !this.sourceBuffer.updating) {
                    console.log('Processing last chunk, ending stream');
                    this.mediaSource.endOfStream();
                }
            }
        } catch (error) {
            console.error('Error in processQueue:', error);
        } finally {
            this.isProcessing = false;
            console.log('Queue processing completed');
        }
    }

    async appendToSourceBuffer(chunk) {
        if (!this.sourceBuffer || this.mediaSource.readyState !== 'open') {
            throw new Error('Invalid state for appending');
        }

        try {
            const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
            console.log('Appending chunk of size:', data.length);
            
            this.sourceBuffer.appendBuffer(data);
            
            // Wait for the append to complete
            await new Promise((resolve, reject) => {
                const handleUpdate = () => {
                    console.log('Chunk append completed');
                    this.sourceBuffer.removeEventListener('updateend', handleUpdate);
                    this.sourceBuffer.removeEventListener('error', handleError);
                    resolve();
                };
                
                const handleError = (event) => {
                    console.error('Error appending to sourceBuffer:', event);
                    this.sourceBuffer.removeEventListener('updateend', handleUpdate);
                    this.sourceBuffer.removeEventListener('error', handleError);
                    reject(event);
                };
                
                this.sourceBuffer.addEventListener('updateend', handleUpdate);
                this.sourceBuffer.addEventListener('error', handleError);
            });
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.log('Buffer full, waiting before retry');
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.appendToSourceBuffer(chunk);
            }
            throw error;
        }
    }

    determineFormat(chunk) {
        // MP3 detection
        if ((chunk[0] === 0x49 && chunk[1] === 0x44 && chunk[2] === 0x33) || // ID3
            (chunk[0] === 0xFF && (chunk[1] & 0xE0) === 0xE0)) { // MPEG frame sync
            return 'mp3';
        }
        // WAV detection
        if (chunk[0] === 0x52 && chunk[1] === 0x49 && 
            chunk[2] === 0x46 && chunk[3] === 0x46) {
            return 'wav';
        }
        return 'mp3';
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

        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            try {
                if (this.sourceBuffer && this.sourceBuffer.updating) {
                    await new Promise(resolve => {
                        this.sourceBuffer.addEventListener('updateend', resolve, { once: true });
                    });
                }
                this.mediaSource.endOfStream();
            } catch (error) {
                console.error('Error ending media stream:', error);
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
            
            console.log('Processing audio chunk:', {
                playbackId,
                isLastChunk,
                chunkSize: chunk.length
            });

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
