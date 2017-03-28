#! /usr/bin/env node

var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/web
var configPath = path.join(__dirname, '../config/config.development.json.sample')
var destinationDir = path.join(currentPath, '../../../config')
var destinationFile = path.join(destinationDir, 'config.development.json')

if (!fs.existsSync(destinationDir)) {
  mkdirp(destinationDir, (err, made) => {
    if (err) throw err

    fs.stat(destinationFile, (err, stats) => {
      if (err && err.code && err.code === 'ENOENT') {
        // file doesn't exist
        fs.readFile(configPath, (err, data) => {
          if (err) throw err

          fs.writeFile(destinationFile, data, (err) => {
            if (err) throw err

            console.log('Web configuration created at', destinationFile)
          })
        })
      }
    })
  })
}