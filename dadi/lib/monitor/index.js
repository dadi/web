/**
 * @module Monitor
 */
const util = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')

const Monitor = function (path) {
  if (!path) throw new Error('Must provide path to instantiate Monitor')

  this.path = path

  const self = this

  try {
    this.watcher = fs.watch(
      this.path,
      { recursive: true },
      (eventName, filename) => {
        self.emit('change', filename)
      }
    )
  } catch (err) {
    // Do nothing if folder doesn't exist
  }
}

// inherits from EventEmitter
util.inherits(Monitor, EventEmitter)

Monitor.prototype.close = function () {
  if (this.watcher) this.watcher.close.apply(this.watcher, arguments)
}

// exports
module.exports = function (path) {
  return new Monitor(path)
}

module.exports.Monitor = Monitor
