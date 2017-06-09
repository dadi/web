var debug = require('debug')('web:public')
var fs = require('fs')
var path = require('path')
var zlib = require('zlib')
var brotli = require('iltorb')
var destroy = require('destroy')
var mime = require('mime-types')
var compressible = require('compressible')
var etag = require('etag')
var url = require('url')
var _ = require('underscore')
var crypto = require('crypto')
var through = require('through')

var Cache = require(path.join(__dirname, '/../cache'))
var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var help = require(path.join(__dirname, '/../help'))
var log = require('@dadi/logger')

var Public = function (req, res, next, files, publicPath, isMiddleware, cache) {
  this.cacheInstance = Cache(cache)
  this.publicPath = publicPath
  this.isMiddleware = isMiddleware
  this.files = []
  this.pushManifest = config
    .get('globalPushManifest')
    .concat(this.cacheInstance.getPushManifest(req))
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
      push: this.pushManifest.includes(i),
      ext: path.extname(i)
    }))

  if (filteredFiles.length) {
    this.files = filteredFiles
    return filteredFiles.forEach(i => this.process(req, res, next, i))
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
  var cacheExt = compressible(contentType) && help.canCompress(req.headers)
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
    'Cache-Control': config.get('headers.cacheControl')[contentType] ||
      'public, max-age=86400',
    'Content-Type': contentType
  }

  if (shouldCompress) headers['Content-Encoding'] = shouldCompress

  // TODO: Check cache is enabled
  // If it's compressible, it's cachable so check the cache or create a new cache file
  if (compressible(contentType)) {
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
      headers['Content-Length'] = stats.size
      headers['Last-Modified'] = stats.mtime.toUTCString()

      // Push?
      if (file.push && res.push && file.url !== req.url) {
        var push = this.push(res, file.url, headers)
        this.compress(push, rs, shouldCompress, cacheInfo)
      } else {
        Object.keys(headers).map(i => res.setHeader(i, headers[i]))
        this.compress(res, rs, shouldCompress, cacheInfo)
      }

      // Compress & pipe
      // this.compress(push || res, rs, shouldCompress, cacheInfo)
    })
  })
}

Public.prototype.setLinkHeaders = function (res) {
  var pushFiles = this.files.filter(i => i.push)
  var linkHeaders = []
  var as = {
    '.css': 'style',
    '.gif': 'image',
    '.html': 'document',
    '.png': 'image',
    '.jpg': 'image',
    '.js': 'script',
    '.json': 'script',
    '.svg': 'image',
    '.webp': 'image',
    '.woff': 'font',
    '.woff2': 'font'
  }

  pushFiles.forEach(i => {
    linkHeaders.push('<' + i.url + ' >; rel=preload; as=' + as[i.ext])
  })

  res.setHeader('Link', linkHeaders.join(','))
}

Public.prototype.push = function (res, file, headers) {
  var err
  var push = res.push(
    file,
    {
      status: 200,
      method: 'GET',
      request: {
        accept: '*/*'
      },
      response: headers
    },
    (_, stream) => {
      function cleanup (error) {
        res.removeListener('error', cleanup)
        res.removeListener('close', cleanup)
        res.removeListener('finish', cleanup)

        destroy(res)
        destroy(stream)

        if (error) err = error
      }

      if (stream) {
        stream.on('error', cleanup)
        stream.on('close', cleanup)
        stream.on('finish', cleanup)
      }
    },
    1
  )

  if (err) {
    if (err.code === 'RST_STREAM') {
      debug('got RST_STREAM %s', err.status)
    } else {
      log.error({ module: 'public' }, err)
    }
  }

  return push
}

Public.prototype.compress = function (res, stream, shouldCompress, cacheInfo) {
  var parent = this

  // Pipe through the cache, if applicable, and send the file on
  function setCache (data) {
    var self = this
    parent.cacheInstance.cache
      .set(cacheInfo.name, data, cacheInfo.opts)
      .then(() => {})
    self.emit('data', data)
  }

  if (shouldCompress === 'br') {
    stream.pipe(brotli.compressStream()).pipe(through(setCache)).pipe(res)
  } else if (shouldCompress === 'gzip') {
    stream.pipe(zlib.createGzip()).pipe(through(setCache)).pipe(res)
  } else if (!cacheInfo) {
    stream.pipe(res)
  } else {
    stream.pipe(through(setCache)).pipe(res)
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
