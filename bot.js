'use strict';
require('dotenv').config();
const path = require('path');
const url = require('url');
const request = require('request');
const TelegramBot = require('node-telegram-bot-api');
const prettysize = require('prettysize');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Check if we have a valid API key
if (!process.env.TELEGRAMKEY || !process.env.MAXSIZEBYTES || isNaN(process.env.MAXSIZEBYTES)) {
	console.error('Telegram API key was not, MaxSize was not set, or .env file is missing');
	process.exit(1);
}


function initListeners(username) {
	// Telegram Required Commands

	// We need to escape our username for regex use
	// Credit bobince & nhahtdh of stackoverflow
	// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
	username = username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	// These commands are required to have responses by the Telegram API 
	telegram.onText(RegExp('/start(?:@' + username + ')?$', 'i'), function(msg, match) {
		console.log('[webm2mp4] New private chat started with', msg.from);
		telegram.sendMessage(msg.chat.id, 'Hello! Upload an WebM for me to convert it to a MP4.');
	});

	telegram.onText(RegExp('/help(?:@' + username + ')?$', 'i'), function(msg, match) {
		console.log('[webm2mp4] Help command used by', msg.from);
		telegram.sendMessage(msg.chat.id, 'Hello! Upload an WebM for me to convert it to a MP4. I can also be added to group chats to automatically convert WebMs.');
	});

	telegram.onText(new RegExp('(https?:\\/\\/[^\\s]+.webm)'), function (msg, match) {
		let filename;
        let r = request(match[0]).on('response', function (res) {
            let contentDisp = res.headers['content-disposition'];
            if (contentDisp && /^attachment/i.test(contentDisp)) {
                filename = contentDisp.toLowerCase()
                    .split('filename=')[1]
                    .split(';')[0]
                    .replace(/"/g, '');
            } else {
                filename = path.basename(url.parse(match[0]).path);
            }
            console.log(filename);
            r.pipe(fs.createWriteStream(path.join(__dirname, filename)));
        });

        r.on('end', function () {
            ffmpeg(filename)
                .output(filename + '.mp4')
                .outputOptions('-strict -2') // Needed since axc is "experimental"
                .on('end', () => {
                    // Cleanup
                    fs.unlink(filename, (e) => {
                        if (e) {
                            console.error(e);
                        }
                    });
                    console.log('[webm2mp4] File', filename, 'converted - Uploading...');
                    telegram.sendVideo(msg.chat.id, filename + '.mp4').then(function() {
                        fs.unlink(filename + '.mp4', (e) => {
                            if (e) {
                                console.error(e);
                            }
                        });
                    });
                })
                .on('error', (e) => {
                    console.error(e);
                    // Cleanup
                    fs.unlink(filename, (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                    fs.unlink(filename + '.mp4', (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });
                })
                .run();
		});
	});

	// The real meat of the bot
	telegram.on('document', (msg) => {
		if (msg.document.mime_type === 'video/webm') {
			// Check the file size
			if (msg.document.file_size > process.env.MAXSIZEBYTES) {
				console.log(process.env.MAXSIZEBYTES)
				console.log('[webm2mp4] ', msg.from, ' uploaded a file that was too big.');
				telegram.sendMessage(msg.chat.id, 'This file is too large for me to convert. It must be less than ' + prettysize(process.env.MAXSIZEBYTES) + '.');
				return;
			}
			// Download it
			telegram.downloadFile(msg.document.file_id, './tmp/').then(function(filename) {
				ffmpeg(filename)
					.output(filename + '.mp4')
					.outputOptions('-strict -2') // Needed since axc is "experimental"
					.on('end', () => {
						// Cleanup
						fs.unlink(filename, (e) => {
							if (e) {
								console.error(e);
							}
						});
						console.log('[webm2mp4] File', msg.document.file_name, 'converted - Uploading...');
						telegram.sendVideo(msg.chat.id, filename + '.mp4').then(function() {
							fs.unlink(filename + '.mp4', (e) => {
								if (e) {
									console.error(e);
								}
							});
						});
					})
					.on('error', (e) => {
						console.error(e);
						// Cleanup
						fs.unlink(filename, (err) => {
							if (err) {
								console.error(err);
							}
						});
						fs.unlink(filename + '.mp4', (err) => {
							if (err) {
								console.error(err);
							}
						});
					})
					.run();
			})
		}
	});
}

// Init
process.env.MAXSIZEBYTES = parseInt(process.env.MAXSIZEBYTES);
if (!fs.existsSync('./tmp/')) {
	fs.mkdirSync('./tmp/');
}
let telegram = null;

// Are we on Heroku?
if (process.env.PORT && !isNaN(process.env.PORT)) {
	if (process.env.APPURL) {
		telegram = new TelegramBot(process.env.TELEGRAMKEY, {
			webHook: {
				port: process.env.PORT
			}
        });
		telegram.setWebHook(`${process.env.APPURL}/bot${process.env.TELEGRAMKEY}`);
	} else {
        const http = require('http');
        const server = http.createServer((req, res) => {
            res.end('Alive!')
        });
        server.listen(parseInt(process.env.PORT), (e) => {
            if (e) {
                return console.error(e)
            }
        });
    }
} else {
    telegram = new TelegramBot(process.env.TELEGRAMKEY, {
        polling: true
    }); // Polling so we don't have to deal with NAT
}

telegram.getMe().then(function(me) {
    console.log('[Telegram] Telegram connection established. Logged in as:', me.username);
    initListeners(me.username);
});