const path = require('path')
const zlib = require('zlib')
const brotli = require('iltorb')
const compressible = require('compressible')
const CircularJSON = require('circular-json')

const config = require(path.join(__dirname, '/../../../config.js'))
const help = require(path.join(__dirname, '/../help'))

/**
 * Sends back JSON
 * @param {res} res - the HTTP response
 * @param {req} req - the HTTP request
 */
module.exports.json = function (statusCode, res, next) {
  return function (err, results) {
    if (err) return next(err)

    const resBody = CircularJSON.stringify(results, null, 2)

    // Only if nothing else has responsed e.g., errorView
    if (!res.headersSent) {
      res.statusCode = statusCode
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Length', Buffer.byteLength(resBody))
      res.end(resBody)
    }
  }
}

/**
 * Sends back HTML
 * @param {res} res - the HTTP response
 * @param {req} req - the HTTP request
 */
module.exports.html = function (req, res, next, statusCode, contentType) {
  return function (err, results) {
    if (err) return next(err)

    let resBody = results

    res.statusCode = statusCode
    res.setHeader('Content-Type', contentType)

    // Add headers
    module.exports.addHeaders(res)

    // Compression
    const shouldCompress = compressible(contentType)
      ? help.canCompress(req.headers)
      : false

    if (shouldCompress) {
      res.setHeader('Content-Encoding', shouldCompress)
      resBody =
        shouldCompress === 'br'
          ? brotli.compressSync(Buffer.from(resBody, 'utf-8'))
          : zlib.gzipSync(resBody)
    }

    res.setHeader('Content-Length', Buffer.byteLength(resBody))

    if (req.method.toLowerCase() === 'head') {
      res.setHeader('Connection', 'close')
      return res.end()
    } else {
      return res.end(resBody)
    }
  }
}

/**
 * Adds headers defined in the configuration file to the response
 * @param {res} res - the HTTP response
 */
module.exports.addHeaders = function (res) {
  const headers = config.get('headers').cors || {}

  Object.keys(headers).forEach(key => {
    res.setHeader(key, headers[key])
    if (key === 'Access-Control-Allow-Origin' && headers[key] !== '*') {
      res.setHeader('Vary', 'Origin')
    }
  })
}
