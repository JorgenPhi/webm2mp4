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
if (!process.env.TELEGRAMKEY) {
	console.error('Telegram API key was not or .env file is missing');
	process.exit(1);
}
// The real meat of the bot
function processVideo(filename, msg) {
    let notification = false;

    ffmpeg(`./tmp/${filename}`)
        .output(`./tmp/${filename}.mp4`)
        .videoCodec('libx264')
        .outputOption('-crf 25')
        .outputOption('-profile:v high')
        .outputOption('-level 4.2')
        .outputOption('-preset veryslow')
        .outputOptions('-strict', '-2') // Needed since axc is "experimental"
        .on('end', () => {
            let videoStat = fs.statSync(`./tmp/${filename}.mp4`);
            let fileSizeInBytes = videoStat.size;
            let fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
            if (fileSizeInMegabytes >= 10) {
                console.log('[webm2mp4] File', filename, 'converted - Generating thumbnail...');
                telegram.sendMessage(msg.chat.id, `Generating thumbnail for: ${filename}...`).then((result) => {
                    setTimeout(function () {
                        telegram.deleteMessage(msg.chat.id, result.message_id);
                    }, 500);
                });

                ffmpeg(`./tmp/${filename}.mp4`).screenshots({
                    timestamps: ['50%'],
                    filename: filename + '.png',
                    folder: './tmp/'
                }).on('end', function () {
                    console.log('[webm2mp4] File', filename, 'finished - Uploading...');
                    telegram.sendPhoto(msg.chat.id, `./tmp/${filename}.png`).then(function () {
                        fs.unlink('./tmp/' + filename + '.png', () => {});
                    });
                });
            } else {
                console.log('[webm2mp4] File', filename, 'finished - Uploading...');
            }

            telegram.sendVideo(msg.chat.id, './tmp/' + filename + '.mp4').then(function() {
                fs.unlink('./tmp/' + filename + '.mp4', () => {});
                fs.unlink('./tmp/' + filename, () => {});
            });
        })
        .on('progress', function(progress) {
            let msglog = filename + ' Processing: ' + progress.percent + '% done';

            console.log(msglog);
            if (!notification && progress.percent >= 50) {
                notification = true;
                telegram.sendMessage(msg.chat.id, msglog, {disable_notification: true}).then((result) => {
                    setTimeout(function () {
                        telegram.deleteMessage(msg.chat.id, result.message_id);
                    }, 500);
                });
            }
        })
        .on('error', (e) => {
            console.error(e);
            // Cleanup
            fs.unlink('./tmp/' + filename, (err) => {
                if (err) {
                    console.error(err);
                }
            });
            fs.unlink('./tmp/' + filename + '.mp4', (err) => {
                if (err) {
                    console.error(err);
                }
            });
        })
        .run();
}

function initListeners(username) {
	// Telegram Required Commands

	// We need to escape our username for regex use
	// Credit bobince & nhahtdh of stackoverflow
	// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
	username = username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	// These commands are required to have responses by the Telegram API 
	telegram.onText(new RegExp('/start(?:@' + username + ')?$', 'i'), function(msg, match) {
		console.log('[webm2mp4] New private chat started with', msg.from.username);
		telegram.sendMessage(msg.chat.id, 'Hello! Upload an WebM for me to convert it to a MP4.');
	});

	telegram.onText(new RegExp('/help(?:@' + username + ')?$', 'i'), function(msg, match) {
		console.log('[webm2mp4] Help command used by', msg.from.username);
		telegram.sendMessage(msg.chat.id, 'Hello! Upload an WebM for me to convert it to a MP4. I can also be added to group chats to automatically convert WebMs.');
	});

	telegram.onText(/^(http|https).*/, function (msg, match) {
        console.log(`[webm2mp4] ${msg.from.username} : ${match[0]}`);
		let filename;
		let status;
        let r = request(match[0]);
        telegram.sendMessage(msg.chat.id, `Started downloading`).then((result) => {
            setTimeout(() => {
                telegram.deleteMessage(msg.chat.id, result.message_id);
            }, 5000);
        });

        r.on('response', function (res) {
        	if (res.statusCode !== 200) {
        		status = false;
                telegram.sendMessage(msg.chat.id, `Failed to download. Code: ${res.statusCode}`);
                return;
			}
			if (res.headers['content-type'].indexOf('video') === -1) {
        	    status = false;
                telegram.sendMessage(msg.chat.id, `Doesn't look like a video`);
                return;
            }

            filename = path.basename(url.parse(match[0]).path);
            console.log(filename);
            status = true;
            r.pipe(fs.createWriteStream(path.join(__dirname, '/tmp/', filename)));
        });

        r.on('end', function () {
        	if (!status) {return;}
			processVideo(filename, msg)
		});

        r.on('error', function (err) {
        	status = false;
        	telegram.sendMessage(msg.chat.id, `Failed to download video. Reason: ${err}`);
            telegram.sendMessage(msg.chat.id, `Debug info: link: ${match[0]}\nfilename: ${filename}`);
		})
	});

	telegram.on('document', (msg) => {
        console.log(`[webm2mp4] ${msg.from.username} : docuemnt ${msg.document.file_id}`);

		if (msg.document.mime_type === 'video/webm') {
			// Download it

            telegram.sendMessage(msg.chat.id, `Started downloading`).then((result) => {
                setTimeout(() => {
                    telegram.deleteMessage(msg.chat.id, result.message_id);
                }, 5000);
            });

            telegram.downloadFile(msg.document.file_id, './tmp/').then(function(filename) {
			    filename = filename.split(path.sep)[1];
				processVideo(filename,msg);
			}).catch((e) => telegram.sendMessage(msg.chat.id, `Failed to download video. Reason: ${e}`));
		}
	});

    telegram.on('video', (msg) => {
        console.log(`[webm2mp4] ${msg.from.username} : video ${msg.video.file_id}`);

        telegram.sendMessage(msg.chat.id, `Started downloading`).then((result) => {
            setTimeout(() => {
                telegram.deleteMessage(msg.chat.id, result.message_id);
            }, 5000);
        });

        telegram.downloadFile(msg.video.file_id, './tmp/').then(function(filename) {
            filename = filename.split(path.sep)[1];
            processVideo(filename,msg);
        }).catch((e) => telegram.sendMessage(msg.chat.id, `Failed to download video. Reason: ${e}`));
    })
}

// Init
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