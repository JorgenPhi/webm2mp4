const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')

function createThumb (File) {
  return new Promise(function (resolve) {
    ffmpeg(`./tmp/${File}.mp4`).screenshots({
      timestamps: ['50%'],
      filename: File + '.jpg',
      folder: './tmp/',
      size: '90x90'
    }).on('end', () => {
      resolve()
    })
  })
}

function cleanup (File, extraVideo) {
  fs.unlink(`./tmp/${File}.mp4`, () => {
  })
  fs.unlink(`./tmp/${File}`, () => {
  })
  if (extraVideo) {
    fs.unlink(`./tmp/${File}.jpg`, () => {
    })
  }
}

function generateProgress (currentProgress) {
  const progressTick = '🔸'
  const inProgressTick = '🔹'
  let bar = ''
  let ticksCount = Math.floor(currentProgress / 10)
  if (ticksCount > 10) {
    ticksCount = 10
  }
  for (let i = 0; i < ticksCount; i++) {
    bar += progressTick
  }
  for (let i = ticksCount; i < 10; i++) {
    bar += inProgressTick
  }
  return bar
}

module.exports = {
  convertFile: async function (File, ctx, msg, url) {
    await ctx.telegram.sendChatAction(msg.chat.id, 'record_video')
    let notification = false
    ffmpeg(`./tmp/${File}`)
      .output(`./tmp/${File}.mp4`)
      .videoCodec('libx264')
      .outputOption('-crf 25')
      .outputOption('-profile:v high')
      .outputOption('-level 4.2')
      .outputOption('-preset medium')
      .outputOptions('-strict', '-2')
      .outputOption('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2').on('end', async () => {

      let videoStat = fs.statSync(`./tmp/${File}.mp4`)
      let fileSizeInBytes = videoStat.size
      let fileSizeInMegabytes = fileSizeInBytes / 1000000.0
      let extraVideo
      if (fileSizeInMegabytes > 50) {
        ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.big_output', { url: url }), {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
        cleanup(File, extraVideo)
        return
      }
      if (fileSizeInMegabytes >= 10) {
        ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.generating_thumbnail', { url: url }), {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
        await createThumb(File)
        extraVideo = { thumb: { source: `./tmp/${File}.jpg` } }
      }
      ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.sending', { url: url }), {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
      await ctx.telegram.sendChatAction(msg.chat.id, 'upload_video')
      ctx.telegram.sendVideo(msg.chat.id, { source: `./tmp/${File}.mp4` }, extraVideo).then(function () {
        ctx.telegram.deleteMessage(msg.chat.id, msg.message_id)
      }).catch((err) => {
        ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.big_output', { url: url }), {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      })
      cleanup(File, extraVideo)
    })
      .on('progress', function (progress) {
        if (Math.floor(Date.now() / 1000) - notification >= 10) {
          ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.processing', {
            url: url,
            progressBar: generateProgress(progress.percent)
          }), { parse_mode: 'HTML', disable_web_page_preview: true })
          notification = Math.floor(Date.now() / 1000)
        }
      })
      .on('error', (e) => {
        ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, ctx.i18n.t('convert.error', {
          url: url
        }), { parse_mode: 'HTML', disable_web_page_preview: true })
        console.error(e)
        // Cleanup
        fs.unlink(`./tmp/${File}`, (err) => {
          if (err) {
            console.error(err)
          }
        })
        fs.unlink(`./tmp/${File}.mp4`, (err) => {
          if (err) {
            console.error(err)
          }
        })
        fs.unlink(`./tmp/${File}.jpg`, (err) => {
          if (err) {
            console.error(err)
          }
        })
      })
      .run()
  }
}
