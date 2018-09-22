const fetch = require('node-fetch')
const { FetchError } = require('node-fetch')
const { createWriteStream } = require('fs')
const path = require('path')

class NotAVideoError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'NotAVideoError'
  }
}

module.exports = {
  downloadFile: async function (url, message) {
    const res = await fetch(url)
    const ext = path.extname(url)
    const contentType = res.headers.get('content-type')
    const isVideoType = Boolean(contentType.includes('video') || contentType.includes('application/octet-stream'))
    if (!isVideoType) {
      throw new NotAVideoError
    }
    return await new Promise((resolve, reject) => {
      const filename = `${message.chat.id}_${message.message_id}` + ext
      const filePath = `./tmp/${filename}`
      const fileStream = createWriteStream(filePath)
      res.body.pipe(fileStream)
      res.body.on('error', (err) => {
        reject(err)
      })
      fileStream.on('finish', function () {
        resolve(filename)
      })
    })
  },
  NotAVideoError, FetchError
}
