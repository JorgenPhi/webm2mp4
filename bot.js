const path = require('path')
const { Composer } = require('micro-bot')
const TelegrafI18n = require('telegraf-i18n')
const { downloadFile, NotAVideoError, FetchError } = require('./utils/download-file')
const { convertFile } = require('./ffmpeg/ffmpeg-converter')

const i18n = new TelegrafI18n({
  defaultLanguage: 'en',
  directory: path.resolve(__dirname, 'locales')
})

const bot = new Composer()
bot.use(i18n)

bot.start(({ reply, i18n, message }) => reply(i18n.t('common.start')))

bot.url(async (ctx) => {
    const urls = ctx.message.entities
      .filter(({ type }) => type === 'url')
      .map(({ offset, length }) => ctx.message.text.substring(offset, offset + length))
    urls.forEach(async function (url) {
        const msg = await ctx.reply(ctx.i18n.t('download_url.start', { url: url }), {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
        await ctx.telegram.sendChatAction(ctx.message.chat.id, 'record_video')
        let downloadedFile
        try {
          downloadedFile = await downloadFile(url, msg)
        } catch (err) {
          console.log('Error ' + err)
          let replyText = ctx.i18n.t('error')
          switch (err.constructor) {
            case TypeError:
              replyText = ctx.i18n.t('download_url.error.filename', { url: url })
              break
            case FetchError:
              replyText = ctx.i18n.t('download_url.error.fetch', { url: url })
              break
            case NotAVideoError:
              replyText = ctx.i18n.t('download_url.error.not_a_video', { url: url })
              break
          }
          await ctx.telegram.editMessageText(
            msg.chat.id, msg.message_id, null,
            replyText, { parse_mode: 'HTML', disable_web_page_preview: true }
          )
          return
        }
        if (downloadedFile) {
          convertFile(downloadedFile, ctx, msg, url)
        }
      }
    )
  }
)
bot.on('document', async (ctx) => {
    if (!(ctx.message.document.mime_type && (ctx.message.document.mime_type === 'video/webm' ||
      ctx.message.document.mime_type === 'application/octet-stream'))) {
      ctx.reply(ctx.i18n.t('download_document.error.not_a_video'), {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'HTML'
      })
      return
    }
    const msg = await ctx.reply(ctx.i18n.t('download_document.start'), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_to_message_id: ctx.message.message_id
    })
    let downloadedFile
    try {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.document.file_id)
      downloadedFile = await downloadFile(fileLink, msg)
    } catch (err) {
      console.log('Error ' + err)
      let replyText = ctx.i18n.t('error')
      switch (err.constructor) {
        case NotAVideoError:
          replyText = ctx.i18n.t('download_document.error.not_a_video')
          break
      }
      await ctx.telegram.editMessageText(
        msg.chat.id, msg.message_id, null,
        replyText, { parse_mode: 'HTML' }
      )
    }
    if (downloadedFile) {
      convertFile(downloadedFile, ctx, msg, '')
    }
  }
)
module.exports = bot
