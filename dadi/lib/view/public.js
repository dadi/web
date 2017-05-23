var debug = require('debug')('web:public')
var fs = require('fs')
var path = require('path')
var zlib = require('zlib')
var brotli = require('iltorb')
var destroy = require('destroy')
var mime = require('mime-types')
var compressible = require('compressible')
var etag = require('etag')
var _ = require('underscore')

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var log = require('@dadi/logger')

var ServePublic = function (publicPath, hosts) {
  return (req, res, next) => {
    if (_.isEmpty(hosts) || _.contains(hosts, req.headers.host)) {
      process(req, res, next, [req.url], publicPath, true)
    }
  }
}

var process = function (req, res, next, files, publicPath, isMiddleware) {
  files.forEach(file => {
    var err
    var filePath = path.join(publicPath, file)
    var mimeType = mime.lookup(file)

    // Compress settings
    var acceptsEncoding = req.headers['accept-encoding'] || ''
    var shouldCompress =
      config.get('headers.useGzipCompression') &&
      compressible(mimeType) &&
      ~acceptsEncoding.indexOf('gzip')
    var acceptsBrotli = ~acceptsEncoding.indexOf('br')

    // 1 year cache for favicon
    var cacheControl = mimeType === 'image/x-icon'
      ? config.get('headers.cacheControl')[mimeType] ||
          'public, max-age=31536000000'
      : config.get('headers.cacheControl')[mimeType] || 'public, max-age=86400'

    var response

    if (isMiddleware) {
      response = res
    } else {
      response = res.push(
        file,
        {
          method: 'GET',
          request: {
            accept: '*/*'
          }
        },
        (_, stream) => {
          function cleanup (error) {
            response.removeListener('error', cleanup)
            response.removeListener('close', cleanup)
            response.removeListener('finish', cleanup)

            destroy(response)

            if (error) err = error
          }

          stream.on('error', cleanup)
          stream.on('close', cleanup)
          stream.on('finish', cleanup)
        },
        1
      )
    }

    // Read and serve
    var rs = fs.createReadStream(filePath)

    // Pipe if the file opens & handle compression
    rs.on('open', () => {
      if (shouldCompress && acceptsBrotli) {
        rs.pipe(brotli.compressStream()).pipe(response)
      } else if (shouldCompress) {
        rs.pipe(zlib.createGzip()).pipe(response)
      } else {
        rs.pipe(response)
      }
    })

    // Set headers once we see data
    rs.on('data', data => {
      response.statusCode = 200
      response.setHeader('Cache-Control', cacheControl)
      if (mimeType) response.setHeader('Content-Type', mimeType)
      if (shouldCompress) {
        response.setHeader('Content-Encoding', acceptsBrotli ? 'br' : 'gzip')
      } else {
        response.setHeader('Content-Length', Buffer.byteLength(data))
      }
      response.setHeader('ETag', etag(data))
    })

    // Move on if something goes wrong
    rs.on('error', () => {
      next()
    })

    // Catch http2 errors
    if (err) {
      if (err.code === 'RST_STREAM') {
        debug('got RST_STREAM %s', err.status)
      } else {
        log.error({ module: 'public' }, err)
      }
    }
  })
}

module.exports = {
  middleware: ServePublic,
  process: process
}
