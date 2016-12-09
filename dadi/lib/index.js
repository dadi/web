var version = require('../../package.json').version
var site = require('../../package.json').name
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])

var _ = require('underscore')
var bodyParser = require('body-parser')
var colors = require('colors')  // eslint-disable-line
var compress = require('compression')
var crypto = require('crypto')
var dust = require('./dust')
var enableDestroy = require('server-destroy')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var raven = require('raven')
var serveFavicon = require('serve-favicon')
var serveStatic = require('serve-static')
var session = require('express-session')
var toobusy = require('toobusy-js')
var url = require('url')
var dadiStatus = require('@dadi/status')

var MongoStore
if (nodeVersion < 1) {
  MongoStore = require('connect-mongo/es5')(session)
} else {
  MongoStore = require('connect-mongo')(session)
  var RedisStore = require('connect-redis')(session)
}

// let's ensure there's at least a dev config file here
var devConfigPath = path.join(__dirname, '/../../config/config.development.json')
fs.stat(devConfigPath, (err, stats) => {
  if (err && err.code && err.code === 'ENOENT') {
    fs.writeFileSync(devConfigPath, fs.readFileSync(devConfigPath + '.sample'))
  }
})

var api = require(path.join(__dirname, '/api'))
var apiMiddleware = require(path.join(__dirname, '/api/middleware'))
var auth = require(path.join(__dirname, '/auth'))
var cache = require(path.join(__dirname, '/cache'))
var Controller = require(path.join(__dirname, '/controller'))
var forceDomain = require(path.join(__dirname, '/controller/forceDomain'))
var help = require(path.join(__dirname, '/help'))
var Middleware = require(path.join(__dirname, '/middleware'))
var monitor = require(path.join(__dirname, '/monitor'))
var Page = require(path.join(__dirname, '/page'))
var Preload = require(path.resolve(path.join(__dirname, 'datasource/preload')))
var router = require(path.join(__dirname, '/controller/router'))

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var log = require('@dadi/logger')
log.init(config.get('logging'), config.get('aws'), process.env.NODE_ENV)

/**
 * Creates a new Server instance.
 * @constructor
 */
var Server = function () {
  this.components = {}
  this.monitors = {}

  log.info({module: 'server'}, 'Server logging started.')
}

Server.prototype.start = function (done) {
  var self = this

  this.readyState = 2

  var options = this.loadPaths(config.get('paths') || {})

  // create app
  var app = this.app = api()

  // override config
  if (options.configPath) {
    config.loadFile(options.configPath)
  }

  if (config.get('logging.sentry.dsn') !== '') {
    app.use(raven.middleware.express.requestHandler(config.get('logging.sentry.dsn')))
  }

  if (config.get('rewrites.forceDomain') !== '') {
    app.use(forceDomain({
      hostname: config.get('rewrites.forceDomain'),
      port: 80
    }))
  }

  app.use(apiMiddleware.handleHostHeader())
  app.use(apiMiddleware.setUpRequest())
  app.use(apiMiddleware.transportSecurity())

  // serve static files (css,js,fonts)
  if (options.mediaPath) app.use(serveStatic(options.mediaPath, { 'index': false }))

  if (options.publicPath) {
    app.use(serveStatic(options.publicPath, { 'index': false, maxAge: '1d', setHeaders: setCustomCacheControl }))
    try {
      app.use(serveFavicon((options.publicPath || path.join(__dirname, '/../../public')) + '/favicon.ico'))
    } catch (err) {
      // file not found
    }
  }

  // add debug files to static paths
  if (config.get('debug')) {
    app.use(serveStatic(options.workspacePath + '/debug' || (path.join(__dirname, '/../../workspace/debug')), { 'index': false }))
  }

  // add parsers
  app.use(bodyParser.json())
  app.use(bodyParser.text())
  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: true }))

  // request logging middleware
  app.use(log.requestLogger)

  // add gzip compression
  if (config.get('headers.useGzipCompression')) {
    app.use(compress())
  }

  // update configuration based on domain
  var domainConfigLoaded
  app.use(function (req, res, next) {
    if (domainConfigLoaded) return next()
    config.updateConfigDataForDomain(req.headers.host)
    domainConfigLoaded = true
    return next()
  })

  // session manager
  var sessionConfig = config.get('sessions')

  if (sessionConfig.enabled) {
    var sessionOptions = {
      name: sessionConfig.name,
      secret: sessionConfig.secret,
      resave: sessionConfig.resave,
      saveUninitialized: sessionConfig.saveUninitialized,
      cookie: sessionConfig.cookie
    }

    var store = this.getSessionStore(sessionConfig, config.get('env'))

    if (store) {
      sessionOptions.store = store
    }

    // add the session middleware
    app.use(session(sessionOptions))
  }

  app.use('/config', function (req, res, next) {
    var hash = crypto.createHash('md5').update(config.get('secret') + config.get('app.name')).digest('hex')
    console.log(hash)
    if (url.parse(req.url, true).query.secret === hash) {
      res.statusCode = 200
      // res.end(config.toString())
      res.end(config.getSchemaString())
    } else {
      next()
    }
  })

  // set up cache
  var cacheLayer = cache(self)

  // handle routing & redirects
  router(self, options)

  if (config.get('api.enabled')) {
    // authentication layer
    auth(self)

    // initialise the cache
    cacheLayer.init()
  }

  // start listening
  var server = this.server = app.listen()

  server.on('connection', onConnection)
  server.on('listening', onListening)

  if (config.get('env') !== 'test') {
    server.on('error', onError)
  }

  // enhance with a 'destroy' function
  enableDestroy(server)

  // load app specific routes
  this.loadApi(options)

  // preload data
  Preload().init(options)

  // initialise virtualDirectories for serving static content
  _.each(config.get('virtualDirectories'), function (directory) {
    app.use(serveStatic(path.resolve(directory.path), { index: directory.index, redirect: directory.forceTrailingSlash }))
  })

  // dust configuration
  dust.setDebug(config.get('dust.debug'))
  dust.setDebugLevel(config.get('dust.debugLevel'))
  dust.setConfig('cache', config.get('dust.cache'))
  dust.setConfig('whitespace', config.get('dust.whitespace'))

  this.readyState = 1

  if (config.get('env') !== 'test') {
    // do something when app is closing
    process.on('exit', this.exitHandler.bind(null, {server: this, cleanup: true}))

    // catches ctrl+c event
    process.on('SIGINT', this.exitHandler.bind(null, {server: this, exit: true}))

    // catches uncaught exceptions
    process.on('uncaughtException', this.exitHandler.bind(null, {server: this, exit: true}))
  }

  // this is all sync, so callback isn't really necessary.
  done && done()
}

Server.prototype.exitHandler = function (options, err) {
  var server = options.server

  if (options.cleanup) {
    server.stop(function () {
      toobusy.shutdown()
    })
  }

  if (err) {
    console.log(err)
    if (err.stack) console.log(err.stack.toString())
  }

  if (options.exit) {
    console.log()
    console.log('Server stopped, process exiting...')
    log.info({module: 'server'}, 'Server stopped, process exiting.')
    process.exit()
  }
}

function setCustomCacheControl (res, path) {
  _.each(config.get('headers.cacheControl'), (value, key) => {
    if (serveStatic.mime.lookup(path) === key && value !== '') {
      res.setHeader('Cache-Control', value)
    }
  })
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  this.readyState = 3

  Object.keys(this.monitors).forEach(this.removeMonitor.bind(this))

  Object.keys(this.components).forEach(this.removeComponent.bind(this))

  this.server.destroy()

  this.server.close((err) => {
    this.readyState = 0
    return done && done(err)
  })
}

Server.prototype.loadPaths = function (paths) {
  var options = {}

  options.datasourcePath = path.resolve(paths.datasources || path.join(__dirname, '/../../app/datasources'))
  options.eventPath = path.resolve(paths.events || path.join(__dirname, '/../../app/events'))
  options.pagePath = path.resolve(paths.pages || path.join(__dirname, '/../../app/pages'))
  options.partialPath = path.resolve(paths.partials || path.join(__dirname, '/../../app/partials'))
  options.routesPath = path.resolve(paths.routes || path.join(__dirname, '/../../app/routes'))
  options.middlewarePath = path.resolve(paths.middleware || path.join(__dirname, '/../../app/middleware'))

  options.filtersPath = path.resolve(paths.filters || path.join(__dirname, '/../../app/utils/filters'))
  options.helpersPath = path.resolve(paths.helpers || path.join(__dirname, '/../../app/utils/helpers'))

  options.tokenWalletsPath = path.resolve(paths.tokenWallets || path.join(__dirname, '/../../.wallet'))
  if (paths.media) options.mediaPath = path.resolve(paths.media)

  if (paths.public) options.publicPath = path.resolve(paths.public)

  _.each(options, (path, key) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          this.ensureDirectories(options, () => {
            //
          })
        }
      }
    })
  })

  return options
}

Server.prototype.loadApi = function (options) {
  this.app.use('/api/flush', (req, res, next) => {
    if (help.validateRequestMethod(req, res, 'POST') && help.validateRequestCredentials(req, res)) {
      return help.clearCache(req, (err) => {
        help.sendBackJSON(200, res, next)(err, {
          result: 'success',
          message: 'Succeed to clear'
        })
      })
    } else {
      next()
    }
  })

  this.app.use('/api/status', (req, res, next) => {
    if (help.validateRequestMethod(req, res, 'POST') && help.validateRequestCredentials(req, res)) {
      var params = {
        site: site,
        package: '@dadi/web',
        version: version,
        healthCheck: {
          baseUrl: 'http://' + config.get('server.http.host') + ':' + config.get('server.http.port'),
          routes: config.get('status.routes')
        }
      }

      var httpsEnabled = config.get('server.https.enabled')
      if (httpsEnabled) {
        var httpsHost = config.get('server.https.host')
        var httpsPort = config.get('server.https.port')
        var suffix = httpsPort !== 443 ? ':' + httpsPort : ''
        params.healthCheck.baseUrl = 'https://' + httpsHost + suffix
      }

      dadiStatus(params, (err, data) => {
        if (err) return next(err)
        var resBody = JSON.stringify(data, null, 2)

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('content-length', Buffer.byteLength(resBody))
        res.end(resBody)
      })
    }
  })

  this.ensureDirectories(options, (text) => {
    // load routes
    this.updatePages(options.pagePath, options, false)

    // Load middleware
    this.initMiddleware(options.middlewarePath, options)

    // compile all dust templates
    this.compile(options)

    this.addMonitor(options.datasourcePath, (dsFile) => {
      this.updatePages(options.pagePath, options, true)
    })

    this.addMonitor(options.eventPath, (eventFile) => {
      this.updatePages(options.pagePath, options, true)
    })

    this.addMonitor(options.pagePath, (pageFile) => {
      this.updatePages(options.pagePath, options, true)
      this.compile(options)
    })

    this.addMonitor(options.partialPath, (partialFile) => {
      this.compile(options)
    })

    this.addMonitor(options.routesPath, (file) => {
      if (this.app.Router) {
        this.app.Router.loadRewrites(options, () => {
          this.app.Router.loadRewriteModule()
        })
      }
    })

    log.info({module: 'server'}, 'Load complete.')
  })
}

Server.prototype.initMiddleware = function (directoryPath, options) {
  var middlewares = this.loadMiddleware(directoryPath, options)
  _.each(middlewares, (middleware) => {
    middleware.init(this.app)
  })
}

Server.prototype.loadMiddleware = function (directoryPath, options) {
  if (!fs.existsSync(directoryPath)) return

  var files = fs.readdirSync(directoryPath)

  var middlewares = []

  files.forEach((file) => {
    if (path.extname(file) !== '.js') return

    var name = file.slice(0, file.indexOf('.'))
    var m = new Middleware(name, options)
    middlewares.push(m)
  })

  return middlewares
}

Server.prototype.updatePages = function (directoryPath, options, reload) {
  if (!fs.existsSync(directoryPath)) return

  var pages = fs.readdirSync(directoryPath)

  pages.forEach((page) => {
    if (path.extname(page) !== '.json') return

    // get the full path to the page file
    var pageFilepath = path.join(directoryPath, page)

    // strip the filename minus the extension
    // to use as the page name
    var name = page.slice(0, page.indexOf('.'))

    this.addRoute({
      name: name,
      filepath: pageFilepath
    }, options, reload)
  })
}

Server.prototype.addRoute = function (obj, options, reload) {
  // get the page schema
  var schema

  try {
    schema = require(obj.filepath)
  } catch (err) {
    log.error({module: 'server'}, {err: err}, 'Error loading page schema "' + obj.filepath + '". Is it valid JSON?')
    throw err
  }

  // create a page with the supplied schema,
  // using the filename as the page name
  var page = Page(obj.name, schema)

  // create a handler for requests to this page
  var controller = Controller(page, options, schema.page)

  // add the component to the api by adding a route to the app and mapping
  // `req.method` to component methods
  this.addComponent({
    key: page.key,
    routes: page.routes,
    component: controller,
    filepath: obj.filepath
  }, reload)
}

Server.prototype.addComponent = function (options, reload) {
  if (!options.routes) return

  if (reload) {
    _.each(options.routes, (route) => {
      this.removeComponent(route.path)
    })
  }
  _.each(options.routes, (route) => {
    // only add a route once
    if (this.components[route.path]) return

    this.components[route.path] = options.component

    // configure "index" route
    if (route.path === '/index') {
      this.app.use('/', (req, res, next) => {
        if (options.component[req.method.toLowerCase()]) {
          return options.component[req.method.toLowerCase()](req, res, next)
        }

        return next()
      })
    } else {
      // attach any route constraints
      if (route.constraint) this.app.Router.constrain(route.path, route.constraint)

      this.app.use(route.path, (req, res, next) => {
        if (options.component[req.method.toLowerCase()]) {
          // a matching route found, validate it
          return this.app.Router.validate(route, req, res).then(() => {
            return options.component[req.method.toLowerCase()](req, res, next)
          }).catch((err) => {
            if (err) return next(err)
            // try next route
            if (next) {
              return next()
            } else {
              return help.sendBackJSON(404, res, next)(null, require(options.filepath))
            }
          })
        } else {
          // no matching HTTP method found, try the next matching route or 404
          if (next) {
            return next()
          } else {
            return help.sendBackJSON(404, res, next)(null, require(options.filepath))
          }
        }
      })
    }
  })
}

Server.prototype.removeComponent = function (route) {
  this.app.unuse(route)
  delete this.components[route]
}

Server.prototype.getComponent = function (key) {
  return _.find(this.components, function (component) {
    return component.page.key === key
  })
}

Server.prototype.addMonitor = function (filepath, callback) {
  filepath = path.normalize(filepath)

  // only add one watcher per path
  if (this.monitors[filepath]) return

  var m = monitor(filepath)
  m.on('change', callback)

  this.monitors[filepath] = m
}

Server.prototype.removeMonitor = function (filepath) {
  this.monitors[filepath] && this.monitors[filepath].close()
  delete this.monitors[filepath]
}

Server.prototype.compile = function (options) {
  var templatePath = options.pagePath
  var partialPath = options.partialPath

  var self = this

  // reset the dust cache so
  // templates can be reloaded
  dust.clearCache()

  // Get a list of templates to render based on the registered components
  var componentTemplates = Object.keys(self.components).map(function (route) {
    return path.join(templatePath, self.components[route].page.template)
  })

  // Load component templates
  dust.loadFiles(componentTemplates)
    .then(function () {
      // Load templates in the template folder that haven't already been loaded
      return dust.loadDirectory(templatePath)
    })
    .then(function () {
      // Load partials
      return dust.loadDirectory(partialPath, 'partials', true)
    })
    .then(function () {
      // Load filters
      return dust.requireDirectory(options.filtersPath)
    })
    .then(function () {
      // Load helpers
      return dust.requireDirectory(options.helpersPath)
    })
    .then(function () {
      // Write client-side files
      dust.writeClientsideFiles()
    })
    .catch(function (err) {
      log.error({module: 'server'}, err)

      throw err
    })
}

Server.prototype.getSessionStore = function (sessionConfig, env) {
  if (/development|test/.exec(env) === null) {
    if (sessionConfig.store === '') {
      var message = ''
      message += 'It is not recommended to use an in-memory session store in the ' + env + ' environment. Please change the configuration to one of the following:\n\n'

      sessionConfig.store = 'mongodb://username:password@host/databaseName'
      message += 'MongoDB:\n'.green
      message += JSON.stringify(sessionConfig, null, 2)
      message += '\n\n'

      sessionConfig.store = 'redis://<redis_server_host>:<redis_server_port>'
      message += 'Redis\n'.green
      message += JSON.stringify(sessionConfig, null, 2)
      message += '\n\n'

      sessionConfig.store = ''

      throw new Error(message)
    }
  }

  if (sessionConfig.store === '') {
    return null
  }

  if (sessionConfig.store.indexOf('mongodb') > -1) {
    return new MongoStore({
      url: sessionConfig.store
    })
  } else if (sessionConfig.store.indexOf('redis') > -1) {
    return new RedisStore({
      url: sessionConfig.store
    })
  }
}

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function (options, done) {
  // create workspace directories if they don't exist
  // permissions default to 0777
  var idx = 0
  _.each(options, (dir) => {
    mkdirp(dir, {}, (err, made) => {
      if (err) {
        log.error({module: 'server'}, err)
        console.log(err)
      }

      if (made) {
        log.info({module: 'server'}, 'Created directory ' + made)
        console.log('Created directory ' + made)
      }

      idx++

      if (idx === Object.keys(options).length) return done()
    })
  })
}

/**
 *  Expose VERB type methods for adding routes and middlewares
 *
 *  @param {String} [route] optional
 *  @param {function} callback, any number of callback to be called in order
 *  @return undefined
 *  @api public
 */
Server.prototype.options = buildVerbMethod('options')
Server.prototype.get = buildVerbMethod('get')
Server.prototype.head = buildVerbMethod('head')
Server.prototype.post = buildVerbMethod('post')
Server.prototype.put = buildVerbMethod('put')
Server.prototype.delete = buildVerbMethod('delete')
Server.prototype.trace = buildVerbMethod('trace')

// singleton
module.exports = new Server()

// generate a method for http request methods matching `verb`
// if a route is passed, the node module `path-to-regexp` is
// used to create the RegExp that will test requests for this route
function buildVerbMethod (verb) {
  return function () {
    var args = [].slice.call(arguments, 0)
    var route = typeof arguments[0] === 'string' ? args.shift() : null

    var handler = function (req, res, next) {
      if (!(req.method && req.method.toLowerCase() === verb)) {
        next()
      }

      // push the next route on to the bottom of callback stack in case none of these callbacks send a response
      args.push(next)
      var doCallbacks = function (i) {
        return function (err) {
          if (err) return next(err)

          args[i](req, res, doCallbacks(++i))
        }
      }

      doCallbacks(0)()
    }

    // if there is a route provided, only call for matching requests
    if (route) {
      return this.app.use(route, handler)
    }

    // if no route is provided, call this for all requests
    this.app.use(handler)
  }
}

function onConnection (socket) {
  // set a timeout for the client connection
  socket.setTimeout(config.get('server.socketTimeoutSec') * 1000)
  socket.on('timeout', function () {
    socket.end()
  })
}

function onListening (e) {
  // check that our API connection is valid
  help.isApiAvailable(function (err, result) {
    if (err) {
      console.log(err)
      console.log()
      process.exit(0)
    }

    var env = config.get('env')
    var httpEnabled = config.get('server.http.enabled')
    var httpsEnabled = config.get('server.https.enabled')
    if (!httpEnabled && !httpsEnabled) httpEnabled = true
    var extraPadding = httpEnabled && httpsEnabled && '          ' || ''

    var startText = '\n'
    startText += '  ----------------------------\n'
    startText += '  ' + config.get('app.name').green + '\n'
    startText += "  Started 'DADI Web'\n"
    startText += '  ----------------------------\n'
    if (httpEnabled && !httpsEnabled) {
      startText += '  Server:      '.green + extraPadding + 'http://' + config.get('server.http.host') + ':' + config.get('server.http.port') + '\n'
    } else if (httpsEnabled) {
      if (httpEnabled) {
        startText += '  Server (http > https): '.green + 'http://' + config.get('server.http.host') + ':' + config.get('server.http.port') + '\n'
      }
      startText += '  Server:      '.green + extraPadding + 'https://' + config.get('server.https.host') + ':' + config.get('server.https.port') + '\n'
    }
    startText += '  Version:     '.green + extraPadding + version + '\n'
    startText += '  Node.JS:     '.green + extraPadding + nodeVersion + '\n'
    startText += '  Environment: '.green + extraPadding + env + '\n'
    if (config.get('api.enabled') === true) {
      startText += '  API:         '.green + extraPadding + config.get('api.host') + ':' + config.get('api.port') + '\n'
    } else {
      startText += '  API:         '.green + extraPadding + 'Not found'.red + '\n'
      startText += '  ----------------------------\n'
    }

    if (env !== 'test') {
      console.log(startText)
      console.log('  Copyright %s 2015 DADI+ Limited (https://dadi.tech)'.white, String.fromCharCode(169))
    }
  })
}

function onError (err) {
  if (err.code === 'EADDRINUSE') {
    var message = "Can't connect to local address, is something already listening on port " + config.get('server.port') + '?'
    err.localIp = config.get('server.host')
    err.localPort = config.get('server.port')
    err.message = message
    console.log(err)
    console.log()
    process.exit(0)
  }
}

// function processSortParameter (obj) {
//   var sort = {}
//   if (typeof obj !== 'object' || obj === null) return sort
//
//   _.each(obj, function (value, key) {
//     if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
//       sort[value.field] = (value.order === 'asc') ? 1 : -1
//     }
//   })
//
//   return sort
// }

// function parseRoutes (endpoints, req_path) {
//   var params = {}
//   var route_path = ''
//   _.each(endpoints, function (endpoint) {
//     var paths = endpoint.page.route.paths
//     var req_path_items = req_path.split('/')
//     _.each(paths, function (path) {
//       path_items = path.split('/')
//       if (path_items.length == req_path_items.length) {
//         var alias = _.filter(path_items, function (item) {
//           return item == '' || item.slice(0, 1) != ':'
//         })
//
//         if (_.difference(alias, _.intersection(path_items, req_path_items)).length == 0) {
//           _.each(path_items, function (item, index) {
//             if (item != '' && item.slice(0, 1) == ':') {
//               params[item.slice(1)] = req_path_items[index]
//             }
//           })
//           route_path = path
//         }
//       }
//     })
//   })
//
//   return {
//     route_path: route_path,
//     params: params
//   }
// }
