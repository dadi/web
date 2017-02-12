'use strict'

const debug = require('debug')('dust')
const dust = require('dustjs-linkedin')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const wildcard = require('wildcard')

const config = require(path.join(__dirname, '/../../../config.js'))
const log = require('@dadi/logger')

const Dust = function () {
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

      const writeFunction = append ? fs.appendFile : fs.writeFile

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
  debug('loadDirectory %o %s %s', directory, prefix, recursive)
  prefix = prefix || ''

  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) console.log(err)

      const filesAbsolute = files.map(file => {
        return path.join(directory, file)
      })

      resolve(this.loadFiles(filesAbsolute, prefix, recursive))
    })
  })
}

Dust.prototype.loadFiles = function (files, prefix, recursive) {
  prefix = prefix || ''

  return new Promise((resolve, reject) => {
    let queue = []

    files.forEach(file => {
      const stats = fs.statSync(file)
      const basename = path.basename(file, '.dust')

      if (stats.isDirectory() && recursive) {
        queue.push(this.loadDirectory(file, path.join(prefix, basename)))
      } else if (stats.isFile() && (path.extname(file) === '.dust')) {
        const name = path.join(prefix, basename)

        const readFile = new Promise((resolve, reject) => {
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) return reject(err)

            return resolve(this.load(data, name))
          })
        })

        queue.push(readFile)
      }
    })

    resolve(Promise.all(queue))
  })
}

Dust.prototype.render = function (templateName, data, callback) {
  dust.render(templateName, data, callback)
}

Dust.prototype.requireDirectory = function (directory) {
  return new Promise((resolve, reject) => {
    fs.stat(directory, (err, stats) => {
      if (err) {
        reject(err)
      }

      if (stats.isDirectory()) {
        fs.readdir(directory, (err, files) => {
          if (err) {
            reject(err)
          }

          let filesToRead = files.length

          if (filesToRead === 0) {
            return resolve()
          }

          files.forEach(file => {
            const filepath = path.resolve(directory, file)

            fs.stat(filepath, (err, stats) => {
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
  let queue = []
  let templates = Object.keys(this.templates)

  if (!config.get('dust.clientRender.enabled')) return Promise.resolve(true)

  if (config.get('dust.clientRender.whitelist').length > 0) {
    const whitelist = config.get('dust.clientRender.whitelist')

    templates = templates.filter(templateName => {
      let match = false

      whitelist.forEach(item => {
        match = match || wildcard(item, templateName)
      })

      return match
    })
  }

  // Write templates
  if (config.get('dust.clientRender.format') === 'combined') {
    const templatesOutputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.path'))
    let templatesOutput = ''

    templates.forEach(name => {
      templatesOutput += dust.compile(this.templates[name], name)
    })

    queue.push(this._writeToFile(templatesOutputFile, templatesOutput))
  } else {
    templates.forEach(name => {
      const templatesOutputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.path'), name) + '.js'

      queue.push(this._writeToFile(templatesOutputFile, dust.compile(this.templates[name], name)))
    })
  }

  return Promise.all(queue)
}

module.exports = new Dust()
