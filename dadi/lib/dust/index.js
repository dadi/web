var dust = require('dustjs-linkedin')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var wildcard = require('wildcard')

var config = require(path.join(__dirname, '/../../../config.js'))
var log = require('@dadi/logger')

var Dust = function () {
  this.templates = {}

  // Loading core Dust helpers
  require('dustjs-helpers')

  dust.onLoad = (templateName, opts, callback) => {
    if (!this.templates[templateName]) {
      return callback({message: 'Template not found: ' + templateName}, null)
    }

    return callback(null, this.templates[templateName])
  }
}

Dust.prototype._writeToFile = function (filePath, content, append) {
  return new Promise(function (resolve, reject) {
    mkdirp(path.dirname(filePath), function (err, made) {
      if (err) {
        log.error({module: 'dust'}, {err: err}, "Error creating directory for file '%s'", filePath)

        return reject(err)
      }

      var writeFunction = append ? fs.appendFile : fs.writeFile

      writeFunction.call(this, filePath, content, function (err) {
        if (err) {
          log.error({module: 'dust'}, {err: err}, "Error writing to file '%s'", filePath)

          return reject(err)
        }

        resolve(content)
      })
    })
  })
}

Dust.prototype.clearCache = function () {
  dust.cache = {}
}

Dust.prototype.getEngine = function () {
  return dust
}

Dust.prototype.load = function (source, templateName) {
  this.templates[templateName] = source

  return source
}

Dust.prototype.loadDirectory = function (directory, prefix, recursive) {
  prefix = prefix || ''

  var self = this

  return new Promise(function (resolve, reject) {
    fs.readdir(directory, function (err, files) {
      if (err) console.log(err)

      var filesAbsolute = files.map(function (file) {
        return path.join(directory, file)
      })

      resolve(self.loadFiles(filesAbsolute, prefix, recursive))
    })
  })
}

Dust.prototype.loadFiles = function (files, prefix, recursive) {
  prefix = prefix || ''

  var self = this

  return new Promise(function (resolve, reject) {
    var queue = []

    files.forEach(function (file) {
      fs.stat(file, function (err, stats) {
        if (err) console.log(err)

        var basename = path.basename(file, '.dust')

        if (stats.isDirectory() && recursive) {
          queue.push(self.loadDirectory(file, path.join(prefix, basename)))
        } else if (stats.isFile() && (path.extname(file) === '.dust')) {
          var name = path.join(prefix, basename)

          fs.readFile(file, 'utf8', function (err, data) {
            if (err) console.log(err)
            queue.push(Promise.resolve(self.load(data, name)))
          })
        }
      })
    })

    resolve(Promise.all(queue))
  })
}

Dust.prototype.render = function (templateName, data, callback) {
  dust.render(templateName, data, callback)
}

Dust.prototype.requireDirectory = function (directory) {
  return new Promise(function (resolve, reject) {
    fs.stat(directory, function (err, stats) {
      if (err) {
        reject(err)
      }

      if (stats.isDirectory()) {
        fs.readdir(directory, function (err, files) {
          if (err) {
            reject(err)
          }

          var filesToRead = files.length

          if (filesToRead === 0) {
            return resolve()
          }

          files.forEach(function (file) {
            var filepath = path.resolve(directory, file)

            fs.stat(filepath, function (err, stats) {
              filesToRead--

              if (err) {
                reject(err)
              }

              if (stats.isFile() && (path.extname(filepath) === '.js')) {
                require(filepath)
              }

              if (filesToRead === 0) {
                resolve()
              }
            })
          })
        })
      }
    })
  })
}

Dust.prototype.setConfig = function (key, value) {
  dust.config[key] = value
}

Dust.prototype.setDebug = function (debug) {
  dust.isDebug = debug
}

Dust.prototype.setDebugLevel = function (debugLevel) {
  dust.debugLevel = debugLevel
}

Dust.prototype.setOptions = function (options) {
  this.options = options
}

Dust.prototype.writeClientsideFiles = function () {
  var queue = []
  var templates = Object.keys(this.templates)

  if (config.get('dust.clientRender.whitelist').length > 0) {
    var whitelist = config.get('dust.clientRender.whitelist')

    templates = templates.filter(function (templateName) {
      var match = false

      whitelist.forEach(function (item) {
        match = match || wildcard(item, templateName)
      })

      return match
    })
  }

  // Write templates
  if (config.get('dust.clientRender.enabled')) {
    if (config.get('dust.clientRender.format') === 'combined') {
      var templatesOutputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.path'))
      var templatesOutput = ''

      templates.forEach((name) => {
        templatesOutput += this.templates[name]
      })

      queue.push(this._writeToFile(templatesOutputFile, templatesOutput))
    } else {
      templates.forEach((name) => {
        var templatesOutputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.path'), name) + '.js'

        queue.push(this._writeToFile(templatesOutputFile, this.templates[name]))
      })
    }
  }

  return Promise.all(queue)
}

module.exports = new Dust()
