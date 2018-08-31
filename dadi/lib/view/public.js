const async = require('async')
const brotli = require('iltorb')
const compressible = require('compressible')
const crypto = require('crypto')
const etag = require('etag')
const fs = require('fs')
const mime = require('mime-types')
const path = require('path')
const through = require('through')
const url = require('url')
const zlib = require('zlib')

const Cache = require(path.join(__dirname, '/../cache'))
const config = require(path.resolve(path.join(__dirname, '/../../../config')))
const help = require(path.join(__dirname, '/../help'))

const Public = function (arg) {
  this.cacheInstance = Cache(arg.cache)
  this.publicPath = arg.publicPath
  this.isMiddleware = arg.isMiddleware
  this.files = []
  this.endpoint = this.cacheInstance.getEndpoint(arg.req)
  this.index = arg.index || []
  this.loadAttempts = 0
  this.originalPath = ''

  // Make it so
  this.init({ req: arg.req, res: arg.res, next: arg.next, files: arg.files })
}

Public.prototype.init = function (arg) {
  const filteredFiles = arg.files
    .map(i => url.parse(i).pathname.replace(/\/+$/, ''))
    .filter(i => i.length)
    .map(i => ({
      url: i,
      path: [...new Set([...this.publicPath.split('/'), ...i.split('/')])].join(
        '/'
      ), // Removes any duplicates in a path
      ext: path.extname(i)
    }))

  if (filteredFiles.length) {
    this.files = filteredFiles
    return async.each(filteredFiles, file =>
      this.process({ req: arg.req, res: arg.res, next: arg.next, file })
    )
  } else {
    return arg.next()
  }
}

Public.prototype.process = function (arg) {
  const contentType = mime.lookup(arg.file.url)
  const shouldCompress = compressible(contentType)
    ? help.canCompress(arg.req.headers)
    : false

  // Cache
  const cacheExt =
    compressible(contentType) && help.canCompress(arg.req.headers)
      ? `.${help.canCompress(arg.req.headers)}`
      : null

  const cacheInfo = {
    name: crypto
      .createHash('sha1')
      .update(arg.file.url)
      .digest('hex'),
    opts: {
      directory: {
        extension: mime.extension(contentType) + cacheExt
      }
    }
  }

  // Headers
  const headers = {
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
          headers
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
          headers,
          shouldCompress,
          cacheInfo
        })
      })
  } else {
    return this.openStream({
      res: arg.res,
      req: arg.req,
      file: arg.file,
      next: arg.next,
      headers,
      shouldCompress
    })
  }
}

Public.prototype.openStream = function (arg) {
  // Normalise file name
  let filePath = decodeURIComponent(arg.file.path.replace(/\+/g, ' '))

  // If a byte range requested e.g., video, audio file
  let rsOpts = {}

  if (!arg.rs && arg.req.headers.range) {
    try {
      const stats = fs.statSync(filePath)
      const parts = arg.req.headers.range.replace(/bytes=/, '').split('-')

      rsOpts.start = parseInt(parts[0], 10),
      rsOpts.end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1

      const chunkSize = rsOpts.end - rsOpts.start + 1

      arg.headers['Content-Range'] = `bytes ${rsOpts.start}-${rsOpts.end}/${
        stats.size
      }`
      arg.headers['Accept-Ranges'] = 'bytes'
      arg.headers['Content-Length'] = chunkSize
      arg.res.statusCode = 206 // partial content
    } catch (err) {
      return arg.next()
    }
  }

  // Create a readstream if it hasn't been passed from the cache
  if (!arg.rs) arg.rs = fs.createReadStream(filePath, rsOpts)

  // Try to load a folder index, if nothing found
  arg.rs.on('error', (err) => {
    if (this.loadAttempts === 0) this.originalPath = filePath

    if (this.index[this.loadAttempts]) {
      this.process({
        req: arg.req,
        res: arg.res,
        next: arg.next,
        file: {
          url: arg.file.url,
          ext: arg.file.ext,
          path: path.join(
            this.originalPath,
            this.index[this.loadAttempts] || ''
          )
        }
      })
    } else {
      return arg.next()
    }

    this.loadAttempts++
  })

  // Pipe if the file opens & handle compression
  arg.rs.on('open', fd => {
    fs.fstat(fd, (err, stats) => {
      if (err && this.isMiddleware) return arg.next()

      // Extra headers from fstat
      arg.headers['ETag'] = etag(stats)
      arg.headers['Last-Modified'] = stats.mtime.toUTCString()
      if (!arg.headers['Content-Length'] && !arg.req.headers.range) {
        arg.headers['Content-Length'] = stats.size
      }

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
  const parent = this
  const data = []

  const extras = through(
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
    arg.rs
      .pipe(brotli.compressStream())
      .pipe(extras)
      .pipe(arg.res)
  } else if (arg.shouldCompress === 'gzip') {
    arg.rs
      .pipe(zlib.createGzip())
      .pipe(extras)
      .pipe(arg.res)
  } else {
    arg.rs.pipe(extras).pipe(arg.res)
  }
}

module.exports = {
  middleware: function (publicPath, cache, hosts) {
    return (req, res, next) => {
      if (!hosts || hosts.includes(req.headers.host)) {
        return new Public({
          req,
          res,
          next,
          files: [req.url],
          publicPath,
          isMiddleware: true,
          cache
        })
      }
    }
  },
  virtualDirectories: function (directory, cache, hosts) {
    return (req, res, next) => {
      if (!Array.isArray(directory.index)) directory.index = [directory.index]

      return new Public({
        req,
        res,
        next,
        files: [req.url],
        publicPath: path.resolve(directory.path),
        isMiddleware: true,
        cache,
        index: directory.index
      })
    }
  },
  process: function (req, res, next, files, publicPath, isMiddleware, cache) {
    return new Public({
      req,
      res,
      next,
      files,
      publicPath,
      isMiddleware: false,
      cache
    })
  }
}
