var path = require('path')
var zlib = require('zlib')
var brotli = require('iltorb')
var compressible = require('compressible')

var config = require(path.join(__dirname, '/../../../config.js'))

var self = this

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
    var acceptEncoding = req.headers['accept-encoding'] || ''
    var compressType = null
    if (~acceptEncoding.indexOf('gzip')) compressType = 'gzip'
    if (~acceptEncoding.indexOf('br')) compressType = 'br'

    if (
      config.get('headers.useCompression') &&
      compressible(contentType) &&
      compressType
    ) {
      res.setHeader('Content-Encoding', compressType)
      resBody = compressType === 'br'
        ? brotli.compressSync(Buffer.from(resBody, 'utf-8'))
        : zlib.gzipSync(resBody)
    } else {
      res.setHeader('Content-Length', Buffer.byteLength(resBody))
    }

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
  var headers = config.get('headers').cors || []

  headers.forEach((value, header) => {
    res.setHeader(header, value)
    if (header === 'Access-Control-Allow-Origin' && value !== '*') {
      res.setHeader('Vary', 'Origin')
    }
  })
}
