var chokidar = require('chokidar')
var cluster = require('cluster')
var config = require('./config')
var debug = require('debug')('cluster')
var fs = require('fs')
var path = require('path')

var app
var log = require('@dadi/logger')
log.init(config.get('logging'))

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

if (config.get('cluster')) {
  if (cluster.isMaster) {
    var numWorkers = require('os').cpus().length
    log.info('Starting DADI Web in cluster mode, using ' + numWorkers + ' workers.')
    log.info('Master cluster setting up ' + numWorkers + ' workers...')

    // Start new workers
    for (var i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    // New worker alive
    cluster.on('online', function (worker) {
      log.info('Worker ' + worker.process.pid + ' is online')
    })

    // Handle a thread exit, start a new worker
    cluster.on('exit', function (worker, code, signal) {
      log.info('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
      log.info('Starting a new worker')

      cluster.fork()
    })

    // Watch the current directory for a "restart.web" file
    var watcher = chokidar.watch(process.cwd(), {
      depth: 0,
      ignored: /(^|[/\\])\../,  // ignores dotfiles, see https://regex101.com/r/7VuO4e/1
      ignoreInitial: true
    })

    watcher.on('add', function (filePath) {
      if (path.basename(filePath) === 'restart.web') {
        log.info('Shutdown requested')
        fs.unlinkSync(filePath)
        restartWorkers()
      }
    })
  } else {
    // Start Workers
    app = require(path.join(__dirname, '/index.js'))

    app.start(function () {
      log.info('Process ' + process.pid + ' is listening for incoming requests')

      process.on('message', function (message) {
        if (message.type === 'shutdown') {
          log.info('Process ' + process.pid + ' is shutting down...')

          process.exit(0)
        }
      })
    })
  }
} else {
  // Single thread start
  debug('starting DADI Web in single thread mode.')

  app = require(path.join(__dirname, '/index.js'))
  app.start(function () {
    debug('process ' + process.pid + ' is listening for incoming requests')
  })
}

function restartWorkers () {
  var wid
  var workerIds = []

  for (wid in cluster.workers) {
    workerIds.push(wid)
  }

  workerIds.forEach(function (wid) {
    if (cluster.workers[wid]) {
      cluster.workers[wid].send({
        type: 'shutdown',
        from: 'master'
      })

      setTimeout(function () {
        if (cluster.workers[wid]) {
          cluster.workers[wid].kill('SIGKILL')
        }
      }, 5000)
    }
  })
}

// export the modules
module.exports.App = app
module.exports.Config = require('./config')
module.exports.Event = require(path.join(__dirname, '/dadi/lib/event'))
module.exports.Preload = require(path.join(__dirname, '/dadi/lib/datasource/preload'))

// Loaded page & route components
module.exports.Components = require(path.join(__dirname, '/dadi/lib')).components

// Dust template lib
module.exports.Dust = require(path.join(__dirname, '/dadi/lib/dust'))
