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

var ServePublic = function (app, publicPath, hosts) {
  app.use((req, res, next) => {
    // attempts to serve a static file if the current host header matches
    // one of the host names specified when this middleware was added to the stack

    if (_.isEmpty(hosts) || _.contains(hosts, req.headers.host)) {
      // Only allow GET and HEAD
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('Allow', 'GET, HEAD')
        res.setHeader('Content-Length', '0')
        res.end()
        next()
      }

      // Construct file information
      var acceptsEncoding = req.headers['accept-encoding']
      var file = req.url
      var filePath = path.join(publicPath, file)
      var mimeType = mime.lookup(file)
      var shouldCompress =
        config.get('headers.useGzipCompression') &&
        compressible(mimeType) &&
        ~acceptsEncoding.indexOf('gzip')
      var acceptsBrotli = ~acceptsEncoding.indexOf('br')

      // 1 year cache for favicon
      var cacheControl = mimeType === 'image/x-icon'
        ? config.get('headers.cacheControl')[mimeType] ||
            'public, max-age=31536000000'
        : 'public, max-age=86400'

      // Read and serve
      var rs = fs.createReadStream(filePath)

      // Pipe if the file opens & handle compression
      rs.on('open', () => {
        if (shouldCompress && acceptsBrotli) {
          rs.pipe(brotli.compressStream()).pipe(res)
        } else if (shouldCompress) {
          rs.pipe(zlib.createGzip()).pipe(res)
        } else {
          rs.pipe(res)
        }
      })

      // Set headers once we see data
      rs.on('data', data => {
        res.statusCode = 200
        res.setHeader('Cache-Control', cacheControl)
        if (mimeType) res.setHeader('Content-Type', mimeType)
        if (shouldCompress) {
          res.setHeader('Content-Encoding', acceptsBrotli ? 'br' : 'gzip')
        }
        res.setHeader('ETag', etag(data))
      })

      // Move on if something goes wrong
      rs.on('error', () => {
        next()
      })

      // Wrap up
      rs.on('finish', () => {
        destroy(rs)
        next()
      })
    }
  })
}

module.exports = function (app, publicPath) {
  return new ServePublic(app, publicPath)
}

module.exports.ServePublic = ServePublic
