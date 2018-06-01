var default_api_provider = "Google";

function save_api_options() {
    var api_provider = document.getElementById('api_provider').value;
    var apikey = document.getElementById('apikey').value;
    var chosen_provider_options = get_chosen_provider_options(api_provider);
    chrome.storage.sync.set({
        api_provider: api_provider,
        apikey: apikey,
        chosen_provider_options: chosen_provider_options
    }, function () {
        enable_api_edit_mode(false)
        show_provider_options(api_provider, true);
    });
}

document.getElementById('save_api_options').addEventListener('click', save_api_options);

function save_provider_options() {
    var api_provider = document.getElementById('api_provider').value;
    var chosen_provider_options = get_chosen_provider_options(api_provider);
    chrome.storage.sync.set({
        chosen_provider_options: chosen_provider_options
    }, function () {
    });
}

var divsToMark = document.getElementsByClassName("provider_settings_form_inputs");
for (var i = 0; i < divsToMark.length; i++) {
    divsToMark[i].addEventListener('change', save_provider_options);
}


function restore_options() {
    // Use default value color = 'red' and likesColor = true.
    chrome.storage.sync.get({
        api_provider: default_api_provider,
        apikey: "",
        chosen_provider_options: {}
    }, function (items) {
        document.getElementById('api_provider').value = items.api_provider;
        document.getElementById('apikey').value = items.apikey;
        if (items.apikey != "") {
            enable_api_edit_mode(false);
            set_chosen_provider_options(items.api_provider, items.chosen_provider_options);
            show_provider_options(items.api_provider, true);
        }
    });
}

document.addEventListener('DOMContentLoaded', restore_options);

var languages;
var voices;
function get_provider_options(api_provider, api_key) {
    if (api_provider == "Google") {
        endpoint = "https://texttospeech.googleapis.com/v1beta1/voices?key=" + api_key
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                voices = this.response.voices;
                var raw_codes = new Array;
                for (var i = 0; i < voices.length; i++) {
                    raw_codes.push(voices[i].languageCodes[0]); // depending on what you're doing
                }
                languages = new Array(new Set(raw_codes));
            }
        };
        xhr.responseType = 'json';
        xhr.open('GET', endpoint, true);
        xhr.send();
    } else {
        alert("Sorry, no such provider is available now.")
    }
}

function get_chosen_provider_options(api_provider) {
    if (api_provider == "Google") {
        return {
            voice: document.getElementById("voice").value
        }
    }
}

function set_chosen_provider_options(api_provider, chosen_provider_options) {
    if (api_provider == "Google") {
        document.getElementById("voice").value = chosen_provider_options.voice
    }
}

function change_api_key() {
    enable_api_edit_mode(true);
}

document.getElementById('change_api_key').addEventListener('click', change_api_key);

function enable_api_edit_mode(status) {
    if (status == true) {
        document.getElementById('change_api_key').style.display = "none";
        document.getElementById('save_api_options').style.display = "";
        var divsToHide = document.getElementsByClassName("api_settings_form_inputs"); //divsToHide is an array
        for (var i = 0; i < divsToHide.length; i++) {
            divsToHide[i].removeAttribute("disabled");
        }
    } else {
        document.getElementById('change_api_key').style.display = "";
        document.getElementById('save_api_options').style.display = "none";
        var divsToHide = document.getElementsByClassName("api_settings_form_inputs"); //divsToHide is an array
        for (var i = 0; i < divsToHide.length; i++) {
            divsToHide[i].disabled = "disabled";
        }
    }
}

function show_provider_options(api_provider, status) {
    if (status == true) {
        if (api_provider == "Google") {
            document.getElementById('provider_settings_form').style.display = "";
        }
    } else {
        if (api_provider == "Google") {
            document.getElementById('provider_settings_form').style.display = "none";
        }
    }
}

function set_provider_options(api_provider, provider_options) {
    if (api_provider == "Google") {

    }
}


document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("help_link").addEventListener("click", openIndex);
}
)

function openIndex() {
    chrome.tabs.create({ active: true, url: "https://hmirin.github.io/speechy/installed#usage" });
}