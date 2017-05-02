const fs = require('fs')
const log = require('@dadi/logger')
const mkdirp = require('mkdirp')
const path = require('path')

const readDirectory = (directory, options) => {
  options = options || {}

  const extensions = options.extensions
  const recursive = options.recursive

  let matchingFiles = []
  let queue = []

  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) return reject(err)

      files.forEach(file => {
        const absolutePath = path.join(directory, file)
        const stats = fs.statSync(absolutePath)
        const isValidExtension =
          !extensions || extensions.indexOf(path.extname(file)) !== -1

        if (stats.isFile() && isValidExtension) {
          matchingFiles.push(absolutePath)
        } else if (stats.isDirectory() && recursive) {
          queue.push(
            readDirectory(absolutePath, {
              extensions: extensions,
              recursive: true
            }).then(childFiles => {
              matchingFiles = matchingFiles.concat(childFiles)
            })
          )
        }
      })

      Promise.all(queue).then(() => {
        resolve(matchingFiles)
      })
    })
  })
}

const readFiles = (files, options) => {
  options = options || {}

  const callback = options.callback
  const extensions = options.extensions

  if (typeof callback !== 'function') {
    return Promise.reject()
  }

  return new Promise((resolve, reject) => {
    let queue = []

    files.forEach(file => {
      const extension = path.extname(file)

      if (extensions && extensions.indexOf(extension) === -1) {
        return
      }

      const stats = fs.statSync(file)

      if (!stats.isFile()) return

      queue.push(callback(file))
    })

    resolve(Promise.all(queue))
  })
}

const writeToFile = function (filePath, content, append) {
  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(filePath), (err, made) => {
      if (err) {
        log.error(
          { module: 'templates' },
          { err: err },
          "Error creating directory for file '%s'",
          filePath
        )

        return reject(err)
      }

      const writeFunction = append ? fs.appendFile : fs.writeFile

      writeFunction.call(this, filePath, content, err => {
        if (err) {
          log.error(
            { module: 'templates' },
            { err: err },
            "Error writing to file '%s'",
            filePath
          )

          return reject(err)
        }

        resolve(content)
      })
    })
  })
}

module.exports.readDirectory = readDirectory
module.exports.readFiles = readFiles
module.exports.writeToFile = writeToFile
