// Options are given as follows:
// api_provider: "Google" or "OpenAI"
// openai_apikey: string or ""
// google_apikey: string or ""
// openai_voice: string || "alloy"
// openai_model: string || "tts-1"
// google_voice: string || "en-US-Wavenet-D"
// google_speed: number || 1
// chosen_provider_options (deprecated): that has the following keys:
//     api_key (deprecated): string || "" (If this is set, the value must be transferred to google_apikey
//     speed (deprecated): number || 1 (If this is set, the value must be transferred to google_speed)
//     voice (deprecated): string || "en-US-Wavenet-D" (If this is set, the value must be transferred to google_voice)

function restore_options() {
    chrome.storage.sync.get({
        api_provider: "Google",
        openai_apikey: "",
        google_apikey: "",
        openai_voice: "alloy",
        openai_model: "tts-1",
        google_voice: "en-US-Wavenet-D",
        google_speed: 1,
        chosen_provider_options: {}
    }, function (items) {
        // check if deprecated options is not {}
        if (items.chosen_provider_options!== void 0) {
            if (items.chosen_provider_options.api_key !== void 0) {
                items.google_apikey = items.chosen_provider_options.api_key;
            }
            if (items.chosen_provider_options.speed !== void 0) {
                items.google_speed = items.chosen_provider_options.speed;
            }
            if (items.chosen_provider_options.voice !== void 0) {
                items.google_voice = items.chosen_provider_options.voice;
            }
            items.chosen_provider_options = {};
            chrome.storage.sync.set({
                api_provider: items.api_provider,
                openai_apikey: items.openai_apikey,
                google_apikey: items.google_apikey,
                openai_voice: items.openai_voice,
                google_voice: items.google_voice,
                google_speed: items.google_speed,
                chosen_provider_options: {}
            }, function () {
                delete items.chosen_provider_options;
            });
        }
        // set the values to the form elements
        document.getElementById(items.api_provider.toLowerCase()).checked = true;
        document.getElementById('openai_apikey').value = items.openai_apikey;
        document.getElementById('google_apikey').value = items.google_apikey;
        document.getElementById('openai_voice').value = items.openai_voice;
        document.getElementById('openai_model').value = items.openai_model;
        document.getElementById('google_voice').value = items.google_voice;
        document.getElementById('google_speed').value = items.google_speed;
        sync_speed(items.google_speed);
        switch_api_options(items.api_provider);
    });
}
document.addEventListener('DOMContentLoaded', restore_options);

function save_api_options() {
    chrome.storage.sync.set({
        api_provider: document.querySelector('input[name="api_provider"]:checked').value,
        openai_apikey: document.getElementById('openai_apikey').value,
        google_apikey: document.getElementById('google_apikey').value,
        openai_voice: document.getElementById('openai_voice').value,
        openai_model: document.getElementById('openai_model').value,
        google_voice: document.getElementById('google_voice').value,
        google_speed: document.getElementById('google_speed').innerHTML
    });
}

function switch_api_options(api_provider) {
    // set display:none to all the child elements recursively with the class name of the api_provider (lowercase)
    // and set display:block to the elements with the class name of the api_provider (lowercase)
    var api_providers = ["Google", "OpenAI"];
    for (var i = 0; i < api_providers.length; i++) {
        var provider = api_providers[i];
        var elements = document.getElementsByClassName(provider.toLowerCase());
        for (var j = 0; j < elements.length; j++) {
            console.log(provider, api_provider);
            elements[j].style.display = (provider === api_provider) ? "block" : "none";
        }
    }
}

// sync_speed is called when the input element with the id of "google_speed" is changed
function sync_speed(value) {
    value = document.getElementById("google_speed").value;
    document.getElementById("speedometer").innerHTML = value;
}


document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("google_speed").addEventListener("change", function() {
        sync_speed(this.value);
    });    
    document.getElementById("help_link").addEventListener("click", function() {
        chrome.tabs.create({ active: true, url: "https://hmirin.github.io/speechy/installed#usage" });
    });
    var radios = document.querySelectorAll('input[name="api_provider"]');
    for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function() {
            save_api_options();
            switch_api_options(this.value);
        });
    }
    document.getElementById('openai_model').addEventListener('input', save_api_options);
    document.getElementById('openai_apikey').addEventListener('input', save_api_options);
    document.getElementById('google_apikey').addEventListener('input', save_api_options);
    document.getElementById('openai_voice').addEventListener('input', save_api_options);
    document.getElementById('google_voice').addEventListener('input', save_api_options);
    document.getElementById('google_speed').addEventListener('input', save_api_options);
});
