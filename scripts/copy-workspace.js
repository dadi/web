#! /usr/bin/env node

var fs = require('fs-extra')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/web
var workspacePath = path.join(currentPath, 'workspace')
var destinationDir = path.join(currentPath, '../../../workspace')

fs.copy(workspacePath, destinationDir, { overwrite: false }, (err) => {
  if (err) return console.error(err)
  console.log('Web workspace created at', destinationDir)
})
