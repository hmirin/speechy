chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "play_audio") {
        const audio = new Audio("data:audio/wav;base64," + message.audioContent);
        audio.play().catch(error => console.error("Error playing audio:", error));
    }
});
