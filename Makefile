.PHONY: lint

lint:
	npx eslint --config eslint.config.mjs --fix js/config.js js/play_audio.js js/popup.js js/background.js

.PHONY: format

format:
	npx prettier --write js/config.js js/play_audio.js js/popup.js js/background.js

.PHONY: release

release:
	mkdir -p release
	VERSION=$$(jq -r '.version' manifest.json); \
	zip -r release-$$VERSION.zip js images css popup.html manifest.json
