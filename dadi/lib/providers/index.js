'use strict'

const fs = require('fs')
const path = require('path')

const dir = __dirname
const entries = fs.readdirSync(dir)
const modules = {}

entries.forEach(entry => {
  const filename = path.join(dir, entry)
  const name = entry.replace(/\.[^/.]+$/, '')
  const stat = fs.statSync(filename)

  if (stat.isFile() && name !== 'index') {
    modules[name] = require(filename)
  }
})

module.exports = exports = modules
