// play_audio.js
console.log('Speechy audio player initialized');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.action);
    
    if (message.action === "play_audio") {
        try {
            // Clean up any previous audio elements
            if (window.speechyAudio) {
                window.speechyAudio.pause();
                URL.revokeObjectURL(window.speechyAudio.src);
                delete window.speechyAudio;
            }

            // Convert array back to Uint8Array and create blob
            const uint8Array = new Uint8Array(message.audioData);
            const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(blob);

            // Create new audio element
            const audio = new Audio(audioUrl);
            window.speechyAudio = audio;

            // Add event listeners for cleanup
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                delete window.speechyAudio;
            });

            // Start playing
            audio.play().catch(error => {
                console.error("Error playing audio:", error);
                URL.revokeObjectURL(audioUrl);
                delete window.speechyAudio;
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
