chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "play_audio") {
        // Decode the base64 audio content to a playable format
        var audioSrc = "data:audio/wav;base64," + message.audioContent;
        var audio = new Audio(audioSrc);
        audio.play().then(() => {
            console.log("Audio playback started");
        }).catch(error => {
            console.error("Error playing audio:", error);
        });
    }
});
