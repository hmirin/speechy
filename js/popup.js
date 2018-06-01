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

function get_chosen_provider_options(api_provider) {
    if (api_provider == "Google") {
        return {
            voice: document.getElementById("voice").value,
            speed: document.getElementById("speed").value
        }
    }
}

function set_chosen_provider_options(api_provider, chosen_provider_options) {
    if (api_provider == "Google") {
        document.getElementById("voice").value = chosen_provider_options.voice;
        sync_speed(chosen_provider_options.speed)
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


function sync_speed(value) {
    if (value === void 0 || !isFinite(value)) {
        value = document.getElementById("speed").value;
    } else if (value < 0.25 || value > 4) {
        value = 1;
    }
    document.getElementById("speedometer").innerHTML = value;
    document.getElementById("speed").value = value;
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("speed").addEventListener("change", sync_speed);
}
)

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById("help_link").addEventListener("click", openIndex);
}
)

function openIndex() {
    chrome.tabs.create({ active: true, url: "https://hmirin.github.io/speechy/installed#usage" });
}