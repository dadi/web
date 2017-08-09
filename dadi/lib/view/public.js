var fs = require('fs')
var path = require('path')
var zlib = require('zlib')
var brotli = require('iltorb')
var mime = require('mime-types')
var compressible = require('compressible')
var etag = require('etag')
var url = require('url')
var _ = require('underscore')
var crypto = require('crypto')
var through = require('through')
var async = require('async')

var Cache = require(path.join(__dirname, '/../cache'))
var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var help = require(path.join(__dirname, '/../help'))

var Public = function (req, res, next, files, publicPath, isMiddleware, cache) {
  this.cacheInstance = Cache(cache)
  this.publicPath = publicPath
  this.isMiddleware = isMiddleware
  this.files = []
  this.endpoint = this.cacheInstance.getEndpoint(req)

  // Make it so
  this.init(req, res, next, files)
}

Public.prototype.init = function (req, res, next, files) {
  var filteredFiles = files
    .map(i => url.parse(i).pathname.replace(/\/+$/, ''))
    .filter(i => i.length)
    .map(i => ({
      url: i,
      path: path.join(this.publicPath, i),
      ext: path.extname(i)
    }))

  if (filteredFiles.length) {
    this.files = filteredFiles
    return async.each(filteredFiles, i => this.process(req, res, next, i))
  } else {
    return next()
  }
}

Public.prototype.process = function (req, res, next, file) {
  var contentType = mime.lookup(file.url)
  var shouldCompress = compressible(contentType)
    ? help.canCompress(req.headers)
    : false

  // Cache
  var cacheExt =
    compressible(contentType) && help.canCompress(req.headers)
      ? '.' + help.canCompress(req.headers)
      : null

  var cacheInfo = {
    name: crypto.createHash('sha1').update(file.url).digest('hex'),
    opts: {
      directory: {
        extension: mime.extension(contentType) + cacheExt
      }
    }
  }

  // Headers
  var headers = {
    'Cache-Control':
      config.get('headers.cacheControl')[contentType] ||
      'public, max-age=86400',
    'Content-Type': contentType
  }

  if (shouldCompress) headers['Content-Encoding'] = shouldCompress

  // If it's compressible, it's cachable so check the cache or create a new cache file
  if (
    compressible(contentType) &&
    config.get('caching.directory.enabled') &&
    !config.get('debug')
  ) {
    this.cacheInstance.cache
      .get(cacheInfo.name, cacheInfo.opts)
      .then(cacheReadStream => {
        headers['X-Cache-Lookup'] = 'HIT'
        headers['X-Cache'] = 'HIT'

        return this.openStream(
          res,
          req,
          file,
          next,
          cacheReadStream,
          headers,
          false,
          false
        )
      })
      .catch(() => {
        headers['X-Cache'] = 'MISS'
        headers['X-Cache-Lookup'] = 'MISS'

        return this.openStream(
          res,
          req,
          file,
          next,
          false,
          headers,
          shouldCompress,
          cacheInfo
        )
      })
  } else {
    return this.openStream(res, req, file, next, false, headers, false, false)
  }
}

Public.prototype.openStream = function (
  res,
  req,
  file,
  next,
  rs,
  headers,
  shouldCompress,
  cacheInfo
) {
  if (!rs) rs = fs.createReadStream(file.path)

  // Move on if something goes wrong
  rs.on('error', () => {
    return next()
  })

  // Pipe if the file opens & handle compression
  rs.on('open', fd => {
    fs.fstat(fd, (err, stats) => {
      if (err && this.isMiddleware) return next()

      // Extra headers from fstat
      headers['ETag'] = etag(stats)
      headers['Last-Modified'] = stats.mtime.toUTCString()
      headers['Content-Length'] = stats.size

      // Delivery
      this.deliver(res, rs, shouldCompress, cacheInfo, headers)
    })
  })
}

Public.prototype.deliver = function (
  res,
  rs,
  shouldCompress,
  cacheInfo,
  headers
) {
  var parent = this
  var data = []

  var extras = through(
    function write (chunk) {
      if (chunk) data.push(chunk)

      // Update header with the compressed size
      if (cacheInfo) headers['Content-Length'] = data.byteLength

      // Set headers
      try {
        Object.keys(headers).map(i => res.setHeader(i, headers[i]))
      } catch (e) {
        // silence
      }

      // Pass data through
      this.queue(chunk)
    },
    function end () {
      // Set cache if needed
      if (cacheInfo) {
        parent.cacheInstance.cache
          .set(cacheInfo.name, Buffer.concat(data), cacheInfo.opts)
          .then(() => {})
      }

      this.emit('end')
    }
  )

  // Compress
  if (shouldCompress === 'br') {
    rs.pipe(brotli.compressStream()).pipe(extras).pipe(res)
  } else if (shouldCompress === 'gzip') {
    rs.pipe(zlib.createGzip()).pipe(extras).pipe(res)
  } else {
    rs.pipe(extras).pipe(res)
  }
}

module.exports = {
  middleware: function (publicPath, cache, hosts) {
    return (req, res, next) => {
      if (_.isEmpty(hosts) || _.contains(hosts, req.headers.host)) {
        return new Public(req, res, next, [req.url], publicPath, true, cache)
      }
    }
  },
  process: function (req, res, next, files, publicPath, isMiddleware, cache) {
    return new Public(req, res, next, files, publicPath, false, cache)
  }
}
