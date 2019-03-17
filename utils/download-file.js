const fetch = require('node-fetch')
const { FetchError } = require('node-fetch')
const path = require('path')

class NotAVideoError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'NotAVideoError'
  }
}

module.exports = {
  NotAVideoError, FetchError
}
