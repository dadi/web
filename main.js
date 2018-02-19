'use strict'

const chokidar = require('chokidar')
const cluster = require('cluster')
const config = require('./config')
const debug = require('debug')('web:cluster')
const fs = require('fs')
const path = require('path')

const log = require('@dadi/logger')
log.init(config.get('logging'))

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

// Console start message
const dadiBoot = require('@dadi/boot')
dadiBoot.start(require('./package.json'))

let app

function createApp (options) {
  return new Promise((resolve, reject) => {
    options = options || {}

    if (config.get('cluster')) {
      if (cluster.isMaster) {
        let numWorkers = require('os').cpus().length

        log.info(
          'Starting DADI Web in cluster mode, using ' + numWorkers + ' workers.'
        )

        log.info('Master cluster setting up ' + numWorkers + ' workers...')

        // Start new workers
        for (let i = 0; i < numWorkers; i++) {
          cluster.fork()
        }

        // New worker alive
        cluster.on('online', function (worker) {
          log.info('Worker ' + worker.process.pid + ' is online')
        })

        // Handle a thread exit, start a new worker
        cluster.on('exit', function (worker, code, signal) {
          log.info(
            'Worker ' +
              worker.process.pid +
              ' died with code: ' +
              code +
              ', and signal: ' +
              signal
          )
          log.info('Starting a new worker')

          cluster.fork()
        })

        // Watch the current directory for a "restart.web" file
        let watcher = chokidar.watch(process.cwd(), {
          depth: 0,
          ignored: /(^|[/\\])\../, // ignores dotfiles, see https://regex101.com/r/7VuO4e/1
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
        if (app) {
          return resolve({
            App: app,
            Components: app.components
          })
        }

        // Start Workers
        app = require(path.join(__dirname, '/index.js'))(options)

        app.start(function () {
          debug('process %s is listening for incoming requests', process.pid)

          process.on('message', function (message) {
            if (message.type === 'shutdown') {
              log.info('Process ' + process.pid + ' is shutting down...')

              process.exit(0)
            }
          })

          return resolve({
            App: app,
            Components: app.components
          })
        })
      }
    } else {
      if (app) {
        return resolve({
          App: app,
          Components: app.components
        })
      }

      // Single thread start
      debug('starting DADI Web in single thread mode.')

      app = require(path.join(__dirname, '/index.js'))(options)

      app.start(function () {
        debug('process %s is listening for incoming requests', process.pid)

        return resolve({
          App: app,
          Components: app.components
        })
      })
    }
  })
}

function restartWorkers () {
  let wid
  let workerIds = []

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
module.exports = createApp
module.exports.Config = require('./config')
module.exports.Event = require(path.join(__dirname, '/dadi/lib/event'))
module.exports.Preload = require(path.join(
  __dirname,
  '/dadi/lib/datasource/preload'
))
