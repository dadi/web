var fs = require('fs')
var path = require('path')

var dir = __dirname
var entries = fs.readdirSync(dir)
var modules = {}

entries.forEach((entry) => {
  var filename = path.join(dir, entry)
  var name = entry.replace(/\.[^/.]+$/, '')
  var stat = fs.statSync(filename)

  if (stat.isFile() && name !== 'index') {
    modules[name] = require(filename)
  }
})

module.exports = exports = modules
