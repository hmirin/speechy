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
    this.pendingData = null; // For accumulating Google WAV data
  }

  determineFormat(firstChunk) {
    // Check for WAV header (RIFF)
    if (
      firstChunk[0] === 0x52 &&
      firstChunk[1] === 0x49 &&
      firstChunk[2] === 0x46 &&
      firstChunk[3] === 0x46
    ) {
      return "wav";
    }
    // Check for MP3 header
    if (
      (firstChunk[0] === 0x49 &&
        firstChunk[1] === 0x44 &&
        firstChunk[2] === 0x33) || // ID3
      (firstChunk[0] === 0xff && (firstChunk[1] & 0xe0) === 0xe0)
    ) {
      // MPEG frame sync
      return "mp3";
    }
    return this.providerType === "Google" ? "wav" : "mp3";
  }

  async initialize(playbackId) {
    console.log("Initializing playback:", playbackId);

    this.providerType = playbackId.split("-")[0];
    console.log("Provider type:", this.providerType);

    // If already initializing, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        if (this.currentPlaybackId !== playbackId) {
          await this.cleanup();
        }

        // For Google WAV data, use direct Audio element playback
        if (this.providerType === "Google") {
          this.audio = new Audio();
          this.pendingData = new Uint8Array();
          this.isInitialized = true;
          this.currentPlaybackId = playbackId;

          // Add event listeners
          this.audio.addEventListener("canplay", () => {
            console.log("Audio canplay event");
            this.checkAndPlay();
          });

          this.audio.addEventListener("playing", () => {
            console.log("Audio playing event");
            this.hasStartedPlaying = true;
          });

          this.audio.addEventListener("error", (e) => {
            console.error("Audio error:", this.audio.error);
          });

          return;
        }

        // For OpenAI (MP3), use MediaSource
        this.currentPlaybackId = playbackId;
        this.mediaSource = new MediaSource();
        this.audio = new Audio();

        // Add event listeners
        this.audio.addEventListener("canplay", () => {
          console.log("Audio canplay event");
          this.checkAndPlay();
        });

        this.audio.addEventListener("playing", () => {
          console.log("Audio playing event");
          this.hasStartedPlaying = true;
        });

        this.audio.addEventListener("error", (e) => {
          console.error("Audio error:", this.audio.error);
        });

        // Create and set source
        const url = URL.createObjectURL(this.mediaSource);
        console.log("Created URL:", url);
        this.audio.src = url;

        // Wait for source open
        await new Promise((resolve, reject) => {
          const handleOpen = () => {
            this.mediaSource.removeEventListener("sourceopen", handleOpen);
            resolve();
          };
          this.mediaSource.addEventListener("sourceopen", handleOpen);
        });

        console.log("MediaSource opened");
        this.isInitialized = true;
      } catch (error) {
        console.error("Initialization error:", error);
        throw error;
      }
    })();

    await this.initializationPromise;
    this.initializationPromise = null;
  }

  async appendChunk(chunk, isLastChunk = false, playbackId) {
    try {
      if (!this.isInitialized || this.currentPlaybackId !== playbackId) {
        await this.initialize(playbackId);
      }

      // Handle Google WAV data differently
      if (this.providerType === "Google") {
        // Accumulate the chunks
        const newData = new Uint8Array(this.pendingData.length + chunk.length);
        newData.set(this.pendingData);
        newData.set(chunk, this.pendingData.length);
        this.pendingData = newData;

        // On last chunk, create blob and play
        if (isLastChunk) {
          const blob = new Blob([this.pendingData], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          this.audio.src = url;
        }

        return;
      }

      // Handle OpenAI MP3 data with MediaSource
      if (!this.sourceBuffer && this.mediaSource.readyState === "open") {
        this.sourceBuffer = this.mediaSource.addSourceBuffer("audio/mpeg");
        this.sourceBuffer.addEventListener("updateend", () => {
          console.log("SourceBuffer updateend event");
          if (!this.isProcessing) {
            this.processQueue();
          }
        });
      }

      this.queue.push({ chunk, isLastChunk });
      await this.processQueue();
    } catch (error) {
      console.error("Error in appendChunk:", error);
      throw error;
    }
  }

  async checkAndPlay() {
    if (!this.audio || this.hasStartedPlaying || this.audio.readyState < 2)
      return;

    try {
      console.log("Attempting playback");
      await this.audio.play();
      console.log("Playback started successfully");
    } catch (error) {
      console.warn("Playback attempt failed:", error);
      if (!this.hasStartedPlaying) {
        setTimeout(() => this.checkAndPlay(), 100);
      }
    }
  }

  async processQueue() {
    if (this.isProcessing || !this.sourceBuffer || !this.queue.length) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const { chunk, isLastChunk } = this.queue[0];

        if (this.sourceBuffer.updating) {
          await new Promise((resolve) => {
            this.sourceBuffer.addEventListener("updateend", resolve, {
              once: true,
            });
          });
        }

        this.queue.shift();
        this.sourceBuffer.appendBuffer(chunk);
        this.totalBytesAppended += chunk.length;

        await new Promise((resolve) => {
          this.sourceBuffer.addEventListener("updateend", resolve, {
            once: true,
          });
        });

        if (isLastChunk && this.mediaSource.readyState === "open") {
          this.mediaSource.endOfStream();
        }
      }
    } catch (error) {
      console.error("Error in processQueue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  async cleanup() {
    console.log("Starting cleanup");

    if (this.audio) {
      try {
        await this.audio.pause();
        this.audio.currentTime = 0;

        if (this.audio.src) {
          URL.revokeObjectURL(this.audio.src);
          this.audio.removeAttribute("src");
          this.audio.load();
        }
      } catch (error) {
        console.error("Error cleaning up audio:", error);
      }
    }

    this.reset();
    console.log("Cleanup completed");
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
      console.error("Error handling audio message:", error);
      await window.speechyPlayer.cleanup();
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

chrome.runtime.sendMessage({ action: "content_script_ready" });
