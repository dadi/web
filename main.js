var chokidar = require('chokidar')
var cluster = require('cluster')
var config = require('./config')
var fs = require('fs')
var path = require('path')

// export the modules
module.exports.Config = require('./config');
module.exports.Event  = require(__dirname + '/dadi/lib/event');
module.exports.Log    = require(__dirname + '/dadi/lib/log.js');

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

if (config.get('cluster')) {

  if (cluster.isMaster) {
    var numWorkers = require('os').cpus().length
    console.log('Starting DADI Web in cluster mode, using ' + numWorkers + ' workers.')

    console.log('Master cluster setting up ' + numWorkers + ' workers...')

    for(var i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    cluster.on('online', function(worker) {
      console.log('Worker ' + worker.process.pid + ' is online')
    })

    cluster.on('exit', function(worker, code, signal) {
      console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
      console.log('Starting a new worker')
      cluster.fork();
    })

    var watcher = chokidar.watch(process.cwd(), {
      depth: 0,
      ignored: /[\/\\]\./,
      ignoreInitial: true
    })

    watcher.on('add', function(filePath) {
      if (path.basename(filePath) === 'restart.web') {
        console.log('Shutdown requested')
        fs.unlinkSync(filePath)
        restartWorkers()
      }
    })
  }
  else {
    // Start Workers
    var app = require(__dirname + '/index.js')
    app.start(function() {
      console.log('Process ' + process.pid + ' is listening for incoming requests')

      process.on('message', function(message) {
        if (message.type === 'shutdown') {
          console.log('Process ' + process.pid + ' is shutting down...')
          process.exit(0)
        }
      })
    })
  }
} else {
  // Single thread start
  var app = require(__dirname + '/index.js')
  app.start(function() {
    console.log('Process ' + process.pid + ' is listening for incoming requests')
  })
}

function restartWorkers() {
  var wid, workerIds = []

  for(wid in cluster.workers) {
    workerIds.push(wid)
  }

  workerIds.forEach(function(wid) {
    if (cluster.workers[wid]) {
      cluster.workers[wid].send({
        type: 'shutdown',
        from: 'master'
      })

      setTimeout(function() {
        if(cluster.workers[wid]) {
          cluster.workers[wid].kill('SIGKILL')
        }
      }, 5000)
    }
  })
}
