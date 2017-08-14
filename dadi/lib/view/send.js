var path = require('path')
var zlib = require('zlib')
var brotli = require('iltorb')
var compressible = require('compressible')

var config = require(path.join(__dirname, '/../../../config.js'))
var help = require(path.join(__dirname, '/../help'))

var self = this

/**
 * Sends back JSON
 * @param {res} res - the HTTP response
 * @param {req} req - the HTTP request
 */
module.exports.json = function (successCode, res, next) {
  return function (err, results) {
    if (err) return next(err)

    var resBody = JSON.stringify(results, null, 2)

    res.statusCode = successCode
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Length', Buffer.byteLength(resBody))
    res.end(resBody)
  }
}

/**
 * Sends back HTML
 * @param {res} res - the HTTP response
 * @param {req} req - the HTTP request
 */
module.exports.html = function (res, req, next, statusCode, contentType) {
  return function (err, results) {
    if (err) return next(err)

    var resBody = results

    res.statusCode = statusCode
    res.setHeader('Content-Type', contentType)
    self.addHeaders(res)

    // Compression
    var shouldCompress = compressible(contentType)
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
  var headers = config.get('headers').cors || {}

  Object.keys(headers).forEach((key) => {
    res.setHeader(key, headers[key])
    if (key === 'Access-Control-Allow-Origin' && headers[key] !== '*') {
      res.setHeader('Vary', 'Origin')
    }
  })
}
