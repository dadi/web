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

var Public = function (arg) {
  this.cacheInstance = Cache(arg.cache)
  this.publicPath = arg.publicPath
  this.isMiddleware = arg.isMiddleware
  this.files = []
  this.endpoint = this.cacheInstance.getEndpoint(arg.req)

  // Make it so
  this.init({ req: arg.req, res: arg.res, next: arg.next, files: arg.files })
}

Public.prototype.init = function (arg) {
  var filteredFiles = arg.files
    .map(i => url.parse(i).pathname.replace(/\/+$/, ''))
    .filter(i => i.length)
    .map(i => ({
      url: i,
      path: [...new Set([...this.publicPath.split('/'), ...i.split('/')])].join(
        '/'
      ),
      ext: path.extname(i)
    }))

  if (filteredFiles.length) {
    this.files = filteredFiles
    return async.each(filteredFiles, file =>
      this.process({ req: arg.req, res: arg.res, next: arg.next, file: file })
    )
  } else {
    return arg.next()
  }
}

Public.prototype.process = function (arg) {
  var contentType = mime.lookup(arg.file.url)
  var shouldCompress = compressible(contentType)
    ? help.canCompress(arg.req.headers)
    : false

  // Cache
  var cacheExt =
    compressible(contentType) && help.canCompress(arg.req.headers)
      ? '.' + help.canCompress(arg.req.headers)
      : null

  var cacheInfo = {
    name: crypto.createHash('sha1').update(arg.file.url).digest('hex'),
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

        return this.openStream({
          res: arg.res,
          req: arg.req,
          file: arg.file,
          next: arg.next,
          rs: cacheReadStream,
          headers: headers
        })
      })
      .catch(() => {
        headers['X-Cache'] = 'MISS'
        headers['X-Cache-Lookup'] = 'MISS'

        return this.openStream({
          res: arg.res,
          req: arg.req,
          file: arg.file,
          next: arg.next,
          headers: headers,
          shouldCompress: shouldCompress,
          cacheInfo: cacheInfo
        })
      })
  } else {
    return this.openStream({
      res: arg.res,
      req: arg.req,
      file: arg.file,
      next: arg.next,
      headers: headers,
      shouldCompress: shouldCompress
    })
  }
}

Public.prototype.openStream = function (arg) {
  if (!arg.rs) arg.rs = fs.createReadStream(arg.file.path)

  // Move on if something goes wrong
  arg.rs.on('error', () => {
    return arg.next()
  })

  // Pipe if the file opens & handle compression
  arg.rs.on('open', fd => {
    fs.fstat(fd, (err, stats) => {
      if (err && this.isMiddleware) return arg.next()

      // Extra headers from fstat
      arg.headers['ETag'] = etag(stats)
      arg.headers['Last-Modified'] = stats.mtime.toUTCString()
      arg.headers['Content-Length'] = stats.size

      // Delivery
      this.deliver({
        res: arg.res,
        rs: arg.rs,
        shouldCompress: arg.shouldCompress,
        cacheInfo: arg.cacheInfo,
        headers: arg.headers
      })
    })
  })
}

Public.prototype.deliver = function (arg) {
  var parent = this
  var data = []

  var extras = through(
    function write (chunk) {
      if (chunk) data.push(chunk)

      // Update header with the compressed size
      if (arg.shouldCompress) arg.headers['Content-Length'] = data.byteLength

      // Set headers
      try {
        Object.keys(arg.headers).map(i => arg.res.setHeader(i, arg.headers[i]))
      } catch (e) {
        // silence
      }

      // Pass data through
      this.queue(chunk)
    },
    function end () {
      // Set cache if needed
      if (arg.cacheInfo) {
        parent.cacheInstance.cache
          .set(arg.cacheInfo.name, Buffer.concat(data), arg.cacheInfo.opts)
          .then(() => {})
      }

      this.emit('end')
    }
  )

  // Compress
  if (arg.shouldCompress === 'br') {
    arg.rs.pipe(brotli.compressStream()).pipe(extras).pipe(arg.res)
  } else if (arg.shouldCompress === 'gzip') {
    arg.rs.pipe(zlib.createGzip()).pipe(extras).pipe(arg.res)
  } else {
    arg.rs.pipe(extras).pipe(arg.res)
  }
}

module.exports = {
  middleware: function (publicPath, cache, hosts) {
    return (req, res, next) => {
      if (_.isEmpty(hosts) || _.contains(hosts, req.headers.host)) {
        return new Public({
          req: req,
          res: res,
          next: next,
          files: [req.url],
          publicPath: publicPath,
          isMiddleware: true,
          cache: cache
        })
      }
    }
  },
  process: function (req, res, next, files, publicPath, isMiddleware, cache) {
    return new Public({
      req: req,
      res: res,
      next: next,
      files: files,
      publicPath: publicPath,
      isMiddleware: false,
      cache: cache
    })
  }
}
