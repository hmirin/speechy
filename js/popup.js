document.addEventListener('DOMContentLoaded', function() {
    // Restore options
    chrome.storage.sync.get(SPEECHY_CONFIG.DEFAULT_OPTIONS, function(items) {
        document.getElementById(items.api_provider.toLowerCase()).checked = true;
        document.getElementById('openai_apikey').value = items.openai_apikey;
        document.getElementById('google_apikey').value = items.google_apikey;
        document.getElementById('openai_voice').value = items.openai_voice;
        document.getElementById('openai_model').value = items.openai_model;
        document.getElementById('google_voice').value = items.google_voice;
        document.getElementById('google_speed').value = items.google_speed;
        document.getElementById('speedometer').innerHTML = items.google_speed;
        switchApiOptions(items.api_provider);
    });

    // Set up event listeners
    document.getElementById("google_speed").addEventListener("change", function() {
        document.getElementById("speedometer").innerHTML = this.value;
        saveOptions();
    });

    document.getElementById("help_link").addEventListener("click", function() {
        chrome.tabs.create({ url: "https://hmirin.github.io/speechy/installed#usage" });
    });

    document.querySelectorAll('input[name="api_provider"]').forEach(radio => {
        radio.addEventListener('change', function() {
            switchApiOptions(this.value);
            saveOptions();
        });
    });

    ['openai_model', 'openai_apikey', 'google_apikey', 'openai_voice', 'google_voice', 'google_speed']
        .forEach(id => document.getElementById(id).addEventListener('input', saveOptions));
});

function saveOptions() {
    chrome.storage.sync.set({
        api_provider: document.querySelector('input[name="api_provider"]:checked').value,
        openai_apikey: document.getElementById('openai_apikey').value,
        google_apikey: document.getElementById('google_apikey').value,
        openai_voice: document.getElementById('openai_voice').value,
        openai_model: document.getElementById('openai_model').value,
        google_voice: document.getElementById('google_voice').value,
        google_speed: document.getElementById('google_speed').value
    });
}

function switchApiOptions(api_provider) {
    ["google", "openai"].forEach(provider => {
        document.querySelectorAll(`.${provider}`).forEach(el => {
            el.style.display = provider === api_provider.toLowerCase() ? "block" : "none";
        });
    });
}
