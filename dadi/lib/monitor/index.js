/**
 * @module Monitor
 */
const util = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')

class Monitor {
  constructor (path) {
    if (!path) throw new Error('Must provide path to instantiate Monitor')

    this.path = path

    try {
      this.watcher = fs.watch(
        this.path,
        { recursive: true },
        (eventName, filename) => {
          this.emit('change', filename)
        }
      )
    } catch (err) {
      // Do nothing if folder doesn't exist
    }

    // inherits from EventEmitter
    util.inherits(Monitor, EventEmitter)
  }

  close () {
    if (this.watcher) this.watcher.close.apply(this.watcher, arguments)
  }
}

// exports
module.exports = function (path) {
  return new Monitor(path)
}

module.exports.Monitor = Monitor
