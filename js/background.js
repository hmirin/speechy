speaker = new Audio();

selection_error_message = "Couldn't retrieve the selected text. \nNote: Speechy won't work on PDFs, urls starts with chrome:// and Chrome app store, because of the limit of Chrome's API."

chrome.contextMenus.create({
    title: "Read this by Speechy",
    contexts: ["selection"],
    type: "normal",
    onclick: function (info) {
        chrome.tabs.executeScript({
            code: '(' + getSelectionText.toString() + ')()',
            allFrames: true,
            matchAboutBlank: true
        }, function (results) {
            if (results === void 0) {
                alert(selection_error_message);
            } else {
                selectedText = results.reduce(function (sum, value) {
                    if (value) {
                        if (sum) {
                            console.log('Selections have been made in multiple frames:');
                            console.log('Had:', sum, '::  found additional:', value);
                        }
                        return value;
                    }
                    return sum;
                }, '');
                if (selectedText === '') {
                    alert(selection_error_message);
                } else {
                    to_voice(selectedText);
                }
            }
        });
    }
});


//  The following code to get the selection is from an answer to "Get the
//  Highlighted/Selected text" on Stack Overflow, available at:
//  https://stackoverflow.com/a/5379408
//  The answer is copyright 2011-2017 by Tim Down and Makyen. It is
//  licensed under CC BY-SA 3.0, available at
//  https://creativecommons.org/licenses/by-sa/3.0/
function getSelectionText() {
    var text = "";
    var activeEl = document.activeElement;
    var activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
    if (
        (activeElTagName == "textarea") || (activeElTagName == "input" &&
            /^(?:text|search|password|tel|url)$/i.test(activeEl.type)) &&
        (typeof activeEl.selectionStart == "number")
    ) {
        text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
    } else if (window.getSelection) {
        text = window.getSelection().toString();
    }
    return text;
}

function to_voice(text) {
    chrome.storage.sync.get({
        api_provider: "",
        apikey: "",
        chosen_provider_options: {}
    }, function (items) {
        var api_provider = items.api_provider;
        var api_key = items.apikey;
        var chosen_provider_options = items.chosen_provider_options;
        if (api_provider == "Google") {
            google_cloud_tts(text, chosen_provider_options, api_key);
        } else {
            alert("Please select a API provider and setup your API key.");
        };
    });
}

function google_cloud_tts(text, chosen_provider_options, api_key) {
    var endpoint = "https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=" + api_key;
    var language = chosen_provider_options.voice.split("-").slice(0, 2).join("-")
    var speed = chosen_provider_options.speed || 1
    fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
            "input": { "text": text },
            "voice": { "name": chosen_provider_options.voice, "languageCode": language },
            "audioConfig": { "audioEncoding": "LINEAR16", "speakingRate": speed }
        }),
    })
        .then((res) => {
            if (res.ok) {
                res.json().then((json) => {
                    playvoice(json.audioContent);
                });
            } else {
                res.json().then(google_cloud_tts_error_handler);
            }
        })
        .catch(function (err) {
            console.error(err);
            alert("Network error, see console.")
        });
}

function playvoice(audio_string) {
    speaker.src = "data:audio/wav;base64," + audio_string
    speaker.play();
}

function google_cloud_tts_error_handler(err) {
    try {
        alert("Error from Google Cloud Text-to-Speech API\nCode: " + err.error.code + "\nMessage: " + err.error.message + "\nPlease check the options.");
    } catch (e) {
        alert("Something went wrong. Please check settings.");
    }
    console.error(err);
}

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        chrome.tabs.create({ url: "https://hmirin.github.io/speechy/installed" });
    } else if (details.reason == "update") {
        chrome.tabs.create({ url: "https://hmirin.github.io/speechy/installed" });
    }
});