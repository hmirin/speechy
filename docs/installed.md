---
layout: pages
---

# Speechy: Thank you for installation/update!
[See changes from the previous version!](https://github.com/hmirin/speechy/releases)

## Setup

1. You need to get your API key for the API provider you choose. Currently, Speechy supports:
    - [Google Cloud Text-to-Speech API](https://cloud.google.com/text-to-speech/)
        - Description: This API provides WaveNet (Deep Learning based high quality voice synthesis algorithm) voice. Highly recommended!
        - Follow the instruction on [this link](https://support.google.com/cloud/answer/6158862) to get your API key.
            - We recommend you to restrict the API key only to Cloud Text-to-speech API for security.
    - [OpenAI Text-to-Speech API](https://platform.openai.com/docs/guides/text-to-speech)
        - Description: This API provides high quality voice synthesis algorithm. It's also good.
        - Follow the instruction on [this link](https://www.howtogeek.com/885918/how-to-get-an-openai-api-key/) to get your API key.
            - We recommend you to restrict the API key only to Model capabilities for security.

2. Click this extension's icon on the address bar and choose API and add API key and push save.
    ![Screenshot_1](/images/screenshot_1.png)
3. Choose voice you like.
  - For Google Cloud Text-to-Speech API:
    - Choose voice whose language matches the text. 
      - en-US-Wavenet-D is for en-US and the speaker ID is D.
    - We recommend you to use the voice named with "Wavenet".
  - For OpenAI Text-to-Speech API:
    - All voices are multi-lingual. Choose voice you like.

## Usage

1. Select text
2. Click "Read this with Speechy" from the context menu.
    ![Screenshot_2](/images/screenshot_2.png)
