const SPEECHY_CONFIG = {
  ERRORS: {
    NO_SELECTION: "Couldn't retrieve the selected text. \nNote: Speechy won't work on PDFs, urls starts with chrome:// and Chrome app store, because of the limit of Chrome's API.",
    NO_PROVIDER: "Please select an API provider and setup your API key.",
    REFRESH_NEEDED: "Please refresh the page or open a new tab to use Speechy. This error occurs on pages that were opened before the extension was installed. If this persists after refreshing, the page might be restricted by Chrome's API limitations.",
    GOOGLE_TTS: {
      FETCH_FAILED: "Failed to connect to Google TTS API. Please check your internet connection.",
      GENERIC: "An error occurred while using Google TTS service."
    },
    OPENAI_TTS: {
      FETCH_FAILED: "Failed to connect to OpenAI TTS API. Please check your internet connection.",
      GENERIC: "An error occurred while using OpenAI TTS service."
    },
    GENERIC: "An error occurred while processing your request."
  },
  DEFAULT_OPTIONS: {
    api_provider: "Google",
    openai_apikey: "",
    google_apikey: "",
    openai_voice: "alloy",
    openai_model: "tts-1",
    openai_speed: 1,
    google_voice: "en-US-Wavenet-D",
    google_speed: 1,
  },
};
