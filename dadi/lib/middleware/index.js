/**
 * @module Middleware
 */
const debug = require('debug')('web:middleware')
const log = require('@dadi/logger')
const path = require('path')

class Middleware {
  constructor (name, options) {
    debug('loaded %s', name)

    this.name = name
    this.options = options || {}
  }

  load () {
    const filepath = path.join(this.options.middlewarePath, this.name + '.js')

    try {
      // get the file
      return require(filepath)
    } catch (err) {
      throw new Error('Error loading middleware "' + filepath + '". ' + err)
    }
  }

  init (app) {
    try {
      this.load()(app)
    } catch (err) {
      log.error({ module: 'middleware' }, err)
      throw err
    }
  }
}

module.exports = function (name, options) {
  return new Middleware(name, options)
}

module.exports.Middleware = Middleware
