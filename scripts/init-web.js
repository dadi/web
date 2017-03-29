#! /usr/bin/env node

var fs = require('fs')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/web
var destinationFile = path.join(currentPath, '../../../server.js')

// Add an server.js (which runs on npm start) file containing - require('@dadi/web')
// More info: https://docs.npmjs.com/cli/start
fs.stat(destinationFile, (err, stats) => {
  if (err && err.code && err.code === 'ENOENT') {
    // file doesn't exist
    fs.writeFile(destinationFile, "require('@dadi/web')", function(err) {
      if (err) return console.log(err)
      console.log('Web entry point created at', destinationFile)
    })
  }
})