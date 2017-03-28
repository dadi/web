#! /usr/bin/env node

var fs = require('fs')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/web
var destinationFile = path.join(currentPath, '../../../index.js')

// Add an server.js (which runs on npm start) file containing - require('@dadi/web')
// More info: https://docs.npmjs.com/cli/start
if (!fs.existsSync(destinationFile)) {
  fs.writeFile(destinationFile, "require('@dadi/web')", function(err) {
      if (err) return console.log(err)
      console.log("index.js was created!")
  }); 
}