webm2mp4
=====
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://www.heroku.com/deploy?template=https://github.com/JorgenPhi/webm2mp4)

About
-----

After using Telegram on iOS, I quickly realized how much I missed being able to watch [WebM](https://www.webmproject.org/) files on the go. Thanks to drama around [Google ditching Apple's WebKit](https://www.wired.com/2013/04/blink/), it's very likely that Apple devices will never support WebMs natively, so I built this bot.

Features
--------
- Converts WebMs to MP4
- Works in Group Chats

Installing
----------

Install nodejs, npm, and ffmpeg to your system.

Create a Telegram bot using their [official docs](https://core.telegram.org/bots/api).

Copy .env.sample to .env and paste your API key there. You may also want to edit the default file size limit of 10MB.

Run `node bot.js`.

Usage
----------

Simply upload a WebM into any chat where the bot is a participant and it will reply with a fresh MP4.

License
-------

Licensed under GNU GPL v3
See LICENSE.md for the full license text
