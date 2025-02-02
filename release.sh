#!/bin/bash

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create zip file with version number
zip -r "speechy-v${VERSION}.zip" \
    css/ \
    images/ \
    js/ \
    manifest.json \
    popup.html

echo "Created speechy-v${VERSION}.zip"