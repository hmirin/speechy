selection_error_message = "Couldn't retrieve the selected text. \nNote: Speechy won't work on PDFs, urls starts with chrome:// and Chrome app store, because of the limit of Chrome's API."

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "readBySpeechy",
        title: "Read this by Speechy",
        contexts: ["selection"]
    });
});


chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "readBySpeechy") {
        read_selected_text();
    }
});

function read_selected_text() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length === 0) return;
        let tabId = tabs[0].id;

        chrome.scripting.executeScript({
            target: {tabId: tabId, allFrames: true},
            function: getSelectionText,
        }, (results) => {
            if (results && results.length > 0) {
                var selectedText = results.reduce(function(sum, value) {
                    if (value.result) {
                        if (sum) {
                            console.log('Selections have been made in multiple frames:');
                            console.log('Had:', sum, '::  found additional:', value.result);
                        }
                        return value.result;
                    }
                    return sum;
                }, '');
                if (selectedText === '') {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: '/images/icon128.png',
                        title: 'Speechy',
                        message: selection_error_message
                    });
                } else {
                    to_voice(selectedText);
                }
            } else {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/images/icon128.png',
                    title: 'Speechy',
                    message: selection_error_message
                });
            }
        });
    });
}

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
        api_provider: "Google",
        openai_apikey: "",
        google_apikey: "",
        openai_voice: "alloy",
        google_voice: "en-US-Wavenet-D",
        google_speed: 1,
    }, function (items) {
        var api_provider = items.api_provider;
        if (api_provider == "Google") {
            chosen_provider_options = {
                voice: items.google_voice,
                speed: items.google_speed
            };
            api_key = items.google_apikey;
        } else if (api_provider == "OpenAI") {
            chosen_provider_options = {
                voice: items.openai_voice
            };
            api_key = items.openai_apikey;
        }
        if (api_provider == "Google") {
            google_cloud_tts(text, chosen_provider_options, api_key);
        } else if (api_provider == "OpenAI") {
            openai_tts(text, chosen_provider_options, api_key);
        } else {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/images/icon128.png',
                title: 'Speechy',
                message: "Please select a API provider and setup your API key."
            });
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
    // Example of sending a message to a content script to play audio
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {action: "play_audio", audioContent: audio_string});
    });
}


function google_cloud_tts_error_handler(err) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/icon128.png',
            title: 'Speechy',
            message: "Error from Google Cloud Text-to-Speech API\nCode: " + err.error.code + "\nMessage: " + err.error.message + "\nPlease check the options."
        });

    } catch (e) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/icon128.png',
            title: 'Speechy',
            message: "Something went wrong. Please check settings."
        });
    }
    console.error(err);
}

function openai_tts(text, chosen_provider_options, api_key) {
    var endpoint = "https://api.openai.com/v1/audio/speech";
    var voice = chosen_provider_options.voice || "alloy"; // Default voice if not specified
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "tts-1",
            "input": text,
            "voice": "alloy"
        }),
    })
    .then((res) => {
        if (res.ok) {
            res.blob().then((blob) => {
                var reader = new FileReader();
                reader.readAsDataURL(blob); 
                reader.onloadend = function() {
                    var base64data = reader.result;
                    playvoice(base64data.split(',')[1]);
                };
            });
        } else {
            res.json().then(openai_tts_error_handler);
        }
    })
    .catch(function (err) {
        console.error(err);
        alert("Network error, see console.")
    });
}

function openai_tts_error_handler(err) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/icon128.png',
            title: 'Speechy',
            message: "Error from OpenAI Text-to-Speech API\nMessage: " + err.message + "\nPlease check the options."
        });
    } catch (e) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/icon128.png',
            title: 'Speechy',
            message: "Something went wrong. Please check settings."
        });
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

chrome.commands.onCommand.addListener(function(command) {
    if (command == "read_the_selected_text") {
        read_selected_text();
    }
  });