'use strict'

var version = require('../../package.json').version
var site = require('../../package.json').name
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])

var _ = require('underscore')
var bodyParser = require('body-parser')
var colors = require("colors") // eslint-disable-line
var debug = require('debug')('web:server')
var enableDestroy = require('server-destroy')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var session = require('express-session')
var csrf = require('csurf')
var cookieParser = require('cookie-parser')
var toobusy = require('toobusy-js')
var dadiStatus = require('@dadi/status')

var MongoStore = require('connect-mongo')(session)
var RedisStore = require('connect-redis')(session)

// let's ensure there's at least a dev config file here
var devConfigPath = path.join(
  __dirname,
  '/../../config/config.development.json'
)
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
var Send = require(path.join(__dirname, '/view/send'))
var Middleware = require(path.join(__dirname, '/middleware'))
var servePublic = require(path.join(__dirname, '/view/public'))
var monitor = require(path.join(__dirname, '/monitor'))
var Page = require(path.join(__dirname, '/page'))
var Preload = require(path.resolve(path.join(__dirname, 'datasource/preload')))
var router = require(path.join(__dirname, '/controller/router'))
var templateStore = require(path.join(__dirname, '/templates/store'))

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var log = require('@dadi/logger')
log.init(config.get('logging'), config.get('aws'), process.env.NODE_ENV)

/**
 * Creates a new Server instance.
 * @constructor
 */
var Server = function (appOptions) {
  this.components = {}
  this.appOptions = appOptions
  this.monitors = {}
  this.cacheLayer = {}
}

Server.prototype.start = function (done) {
  this.readyState = 2

  var options = this.loadPaths()

  // create app
  var app = (this.app = api())

  // override config
  if (options.configPath) {
    config.loadFile(options.configPath)
  }

  // Load templating engines
  templateStore.loadEngines(this.appOptions && this.appOptions.engines)

  // override configuration variables based on request's host header
  app.use(function virtualHosts (req, res, next) {
    var virtualHosts = config.get('virtualHosts')

    if (_.isEmpty(virtualHosts)) {
      return next()
    }

    var host = _.findKey(virtualHosts, virtualHost => {
      return _.contains(virtualHost.hostnames, req.headers.host)
    })

    // look for a default host
    if (!host) {
      host = _.findKey(virtualHosts, virtualHost => {
        return virtualHost.default === true
      })
    }

    if (!host) {
      return next()
    }

    var hostConfigFile = './config/' + virtualHosts[host].configFile

    fs.stat(hostConfigFile, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        // No domain-specific configuration file
        console.error('Host config not found:', hostConfigFile)
        return next()
      }

      var hostConfig = JSON.parse(fs.readFileSync(hostConfigFile).toString())

      // extend main config with "global" settings for host
      config.load({
        global: hostConfig.global
      })

      return next()
    })
  })

  // add middleware for domain redirects
  if (config.get('rewrites.forceDomain') !== '') {
    var domain = config.get('rewrites.forceDomain')

    app.use(
      forceDomain({
        hostname: domain,
        port: 80
      })
    )
  }

  app.use(apiMiddleware.handleHostHeader())
  app.use(apiMiddleware.setUpRequest())
  app.use(apiMiddleware.transportSecurity())

  // init virtual host public paths
  _.each(config.get('virtualHosts'), (virtualHost, key) => {
    var hostConfigFile = './config/' + virtualHost.configFile

    // TODO catch err

    var stats = fs.statSync(hostConfigFile)
    if (stats) {
      var hostConfig = JSON.parse(fs.readFileSync(hostConfigFile).toString())
      var hostOptions = this.loadPaths(hostConfig.paths)

      app.use(
        servePublic.middleware(
          hostOptions.publicPath,
          this.cacheLayer,
          virtualHost.hostnames
        )
      )
    }
  })

  // add debug files to static paths
  if (config.get('debug')) {
    app.use(
      servePublic.middleware(
        options.workspacePath + '/debug' ||
          path.join(__dirname, '/../../workspace/debug'),
        this.cacheLayer
      )
    )
  }

  // add parsers
  app.use(bodyParser.json())
  app.use(bodyParser.text())
  // parse application/x-www-form-urlencoded
  app.use(bodyParser.urlencoded({ extended: true }))

  // request logging middleware
  app.use(log.requestLogger)

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

  // use csrf protection if enabled
  if (config.get('security.csrf')) {
    if (sessionConfig.enabled) {
      app.use(csrf())
    } else {
      app.use(cookieParser())
      app.use(csrf({ cookie: true }))
    }
  }

  // set up cache
  this.cacheLayer = cache(this)

  // handle routing & redirects
  router(this, options)

  // init main public path for static files
  if (options.publicPath) {
    app.use(servePublic.middleware(options.publicPath, this.cacheLayer))
  }

  // initialise virtualDirectories for serving static content
  var parent = this
  config.get('virtualDirectories').forEach(directory => {
    app.use(servePublic.virtualDirectories(directory, parent.cacheLayer))
  })

  // authentication layer
  if (config.get('api.enabled')) auth(this)

  // Initialise the cache
  this.cacheLayer.init()

  // start listening
  var server = (this.server = app.listen())

  server.on('connection', onConnection)
  server.on('listening', onListening)

  if (config.get('env') !== 'test') {
    server.on('error', onError)
  }

  // enhance with a 'destroy' function
  enableDestroy(server)

  if (app.redirectInstance) {
    enableDestroy(app.redirectInstance)
  }

  // load app specific routes
  this.loadApi(options)

  // load virtual host routes
  _.each(config.get('virtualHosts'), (virtualHost, key) => {
    var hostConfigFile = './config/' + virtualHost.configFile

    fs.stat(hostConfigFile, (err, stats) => {
      if (err && err.code === 'ENOENT') {
        // No domain-specific configuration file
        console.error('Host config not found:', hostConfigFile)
      } else {
        var hostConfig = JSON.parse(fs.readFileSync(hostConfigFile).toString())
        var hostOptions = this.loadPaths(hostConfig.paths)

        hostOptions.host = key

        this.loadApi(hostOptions, true, () => {
          debug('routes loaded for domain "%s"', key)
        })
      }
    })
  })

  // preload data
  Preload().init(options)

  this.readyState = 1

  if (config.get('env') !== 'test') {
    // do something when app is closing
    process.on(
      'exit',
      this.exitHandler.bind(null, {
        server: this,
        cleanup: true
      })
    )

    // catches ctrl+c event
    process.on(
      'SIGINT',
      this.exitHandler.bind(null, {
        server: this,
        exit: true
      })
    )

    // catches uncaught exceptions
    process.on(
      'uncaughtException',
      this.exitHandler.bind(null, {
        server: this,
        exit: true
      })
    )
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
    log.info({ module: 'server' }, 'Server stopped, process exiting.')
    process.exit()
  }
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  this.readyState = 3

  Object.keys(this.monitors).forEach(this.removeMonitor.bind(this))

  Object.keys(this.components).forEach(this.removeComponent.bind(this))

  if (this.server) {
    this.server.destroy()
  }

  if (this.app.redirectInstance) {
    this.app.redirectInstance.destroy()
    delete this.app.redirectInstance
  }

  this.server.close(err => {
    this.readyState = 0
    return done && done(err)
  })
}

Server.prototype.resolvePaths = function (paths) {
  if (Array.isArray(paths)) {
    return _.map(paths, p => {
      return path.resolve(p)
    })
  } else {
    return [path.resolve(paths)]
  }
}

Server.prototype.loadPaths = function (paths) {
  paths = _.extend({}, config.get('paths'), paths || {})
  var options = {}

  options.datasourcePath = path.resolve(paths.datasources)
  options.eventPath = path.resolve(paths.events)
  options.middlewarePath = path.resolve(paths.middleware)
  options.pagePath = path.resolve(paths.pages)
  options.publicPath = path.resolve(paths.public)
  options.routesPath = path.resolve(paths.routes)
  options.tokenWalletsPath = path.resolve(paths.tokenWallets)

  this.ensureDirectories(options, () => {})

  return options
}

Server.prototype.loadApi = function (options, reload, callback) {
  debug('loadApi %o', options)

  if (!reload) {
    this.app.use('/api/flush', (req, res, next) => {
      if (
        help.validateRequestMethod(req, res, 'POST') &&
        help.validateRequestCredentials(req, res)
      ) {
        return help.clearCache(req, this.cacheLayer, err => {
          Send.json(200, res, next)(err, {
            result: 'success',
            message: 'Cache cleared successfully'
          })
        })
      } else {
        next()
      }
    })

    this.app.use('/api/status', (req, res, next) => {
      if (
        help.validateRequestMethod(req, res, 'POST') &&
        help.validateRequestCredentials(req, res)
      ) {
        var params = {
          site: site,
          package: '@dadi/web',
          version: version,
          healthCheck: {
            baseUrl:
              'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port'),
            routes: config.get('status.routes')
          }
        }

        var protocol = config.get('server.protocol') || 'http'
        if (protocol === 'https') {
          var httpsHost = config.get('server.host')
          var httpsPort = config.get('server.port')
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
  }

  // Load middleware
  this.initMiddleware(options.middlewarePath, options)

  // Load routes
  return this.updatePages(
    options.pagePath,
    options,
    reload || false
  ).then(() => {
    this.addMonitor(options.datasourcePath, dsFile => {
      this.updatePages(options.pagePath, options, true)
    })

    this.addMonitor(options.eventPath, eventFile => {
      // Delete the existing cached events
      Object.keys(require.cache).forEach(i => {
        if (i.includes(options.eventPath)) delete require.cache[i]
      })

      // Reload
      this.updatePages(options.pagePath, options, true)
    })

    this.addMonitor(options.pagePath, pageFile => {
      this.updatePages(options.pagePath, options, true)
      this.compile(options)
      templateStore.reInitialise()
    })

    this.addMonitor(options.routesPath, file => {
      if (this.app.Router) {
        this.app.Router.loadRewrites(options, () => {
          this.app.Router.loadRewriteModule()
        })
      }
    })

    debug('load complete')

    if (typeof callback === 'function') {
      callback()
    }
  })
}

Server.prototype.initMiddleware = function (directoryPath, options) {
  var middlewares = this.loadMiddleware(directoryPath, options)
  _.each(middlewares, middleware => {
    middleware.init(this.app)
  })
}

Server.prototype.loadMiddleware = function (directoryPath, options) {
  if (!fs.existsSync(directoryPath)) return

  var files = fs.readdirSync(directoryPath)

  var middlewares = []

  files.forEach(file => {
    if (path.extname(file) !== '.js') return

    var name = file.slice(0, file.indexOf('.'))
    var m = new Middleware(name, options)
    middlewares.push(m)
  })

  return middlewares
}

Server.prototype.updatePages = function (directoryPath, options, reload) {
  return help
    .readDirectory(directoryPath, {
      recursive: true
    })
    .then(pages => {
      pages.forEach(page => {
        // Ignore files that aren't a JSON schema
        if (path.extname(page) !== '.json') return

        const relativePath = path.relative(directoryPath, page)

        // strip the filename minus the extension
        // to use as the page name
        const name = relativePath.slice(0, -'.json'.length)

        // Find a file with the same base name as the JSON file, which will be
        // a candidate to page template.
        let templateCandidate

        pages.some(page => {
          const candidateExtension = path.extname(page)

          if (candidateExtension === '.json') return

          const relativePath = path.relative(directoryPath, page)
          const candidateName = relativePath.slice(
            0,
            -candidateExtension.length
          )

          if (candidateName === name) {
            templateCandidate = candidateName + candidateExtension

            return true
          }
        })

        this.addRoute(
          {
            name: name,
            filepath: page
          },
          _.extend({}, options, {
            templateCandidate: templateCandidate
          }),
          reload
        )
      })

      return this
    })
    .then(pages => {
      // We run `compile()` but return the Server instance.
      return this.compile(options).then(() => this)
    })
}

Server.prototype.addRoute = function (obj, options, reload) {
  // get the page schema
  var schema

  try {
    schema = require(obj.filepath)
  } catch (err) {
    log.error(
      { module: 'server' },
      { err: err },
      'Error loading page schema "' + obj.filepath + '". Is it valid JSON?'
    )
    throw err
  }

  // create a page with the supplied schema,
  // using the filename as the page name
  var page = Page(obj.name, schema, options.host, options.templateCandidate)

  // create a handler for requests to this page
  var controller = new Controller(
    page,
    options,
    schema.page,
    schema.engine,
    this.cacheLayer
  )

  // add the component to the api by adding a route to the app and mapping
  // `req.method` to component methods
  this.addComponent(
    {
      component: controller,
      filepath: obj.filepath,
      host: options.host || '',
      key: page.key,
      routes: page.routes
    },
    reload
  )
}

Server.prototype.addComponent = function (options, reload) {
  if (!options.routes) return

  if (reload) {
    _.each(options.routes, route => {
      var hostWithPath = `${options.host}${route.path}`
      this.removeComponent(hostWithPath)
    })
  }

  _.each(options.routes, route => {
    // only add a route once
    var hostWithPath = `${options.host}${route.path}`

    if (this.components[hostWithPath]) return

    this.components[hostWithPath] = options.component

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
      if (route.constraint) {
        this.app.Router.constrain(route.path, route.constraint)
      }

      // attach route handler to middleware stack
      this.app.use(route.path, options.host, (req, res, next) => {
        debug('use %s', route.path)
        if (options.component[req.method.toLowerCase()]) {
          // a matching route found, validate it
          return this.app.Router
            .validate(route, options.component.options, req, res)
            .then(() => {
              return options.component[req.method.toLowerCase()](req, res, next)
            })
            .catch(err => {
              if (err) return next(err)
              // try next route
              if (next) {
                return next()
              } else {
                return Send.json(404, res, next)(
                  null,
                  require(options.filepath)
                )
              }
            })
        } else {
          // no matching HTTP method found, try the next matching route or 404
          if (next) {
            return next()
          } else {
            return Send.json(404, res, next)(null, require(options.filepath))
          }
        }
      })
    }
  })
}

Server.prototype.removeComponent = function (path) {
  this.app.unuse(path)
  delete this.components[path]
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
  const templatePath = options.pagePath

  // Get a list of templates to render based on the registered components
  const componentTemplates = Object.keys(this.components).map(route => {
    if (this.components[route].options.host === options.host) {
      return {
        engine: this.components[route].engine,
        file: path.join(templatePath, this.components[route].page.template)
      }
    }
  })

  // Loading engines and templates
  return templateStore
    .loadPages(componentTemplates, {
      namespace: options.host
    })
    .then(templates => templateStore.finishLoading())
}

Server.prototype.getSessionStore = function (sessionConfig, env) {
  if (/development|test/.exec(env) === null) {
    if (sessionConfig.store === '') {
      var message = ''
      message +=
        'It is not recommended to use an in-memory session store in the ' +
        env +
        ' environment. Please change the configuration to one of the following:\n\n'

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
  // create workspace directories if they don't exist; permissions default to 0777
  var idx = 0

  _.each(options, dir => {
    if (Array.isArray(dir)) {
      this.ensureDirectories(dir, () => {})
    } else {
      mkdirp(dir, {}, (err, made) => {
        if (err) {
          log.error({ module: 'server' }, err)
        }

        if (made) {
          debug('Created directory %s', made)
        }

        idx++

        if (idx === Object.keys(options).length) return done()
      })
    }
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
module.exports = options => new Server(options)

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
  help.isApiAvailable((err, result) => {
    if (err) {
      console.log(err)
      console.log()
      process.exit(0)
    }

    var env = config.get('env')
    var protocol = config.get('server.protocol') || 'http'
    var redirectPort = config.get('server.redirectPort')
    var engines = Object.keys(templateStore.getEngines())
    var enginesInfo = engines.length ? engines.join(', ') : 'None'.red
    var extraPadding = (redirectPort > 0 && '          ') || ''

    var startText = '\n'
    startText += '  ----------------------------\n'
    startText += '  ' + config.get('app.name').green + '\n'
    startText += "  Started 'DADI Web'\n"
    startText += '  ----------------------------\n'

    if (protocol === 'http') {
      startText +=
        '  Server:      '.green +
        extraPadding +
        'http://' +
        config.get('server.host') +
        ':' +
        config.get('server.port') +
        '\n'
    } else if (protocol === 'https') {
      if (redirectPort > 0) {
        startText +=
          '  Server (http > https): '.green +
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.redirectPort') +
          '\n'
      }
      startText +=
        '  Server:      '.green +
        extraPadding +
        'https://' +
        config.get('server.host') +
        ':' +
        config.get('server.port') +
        '\n'
    }

    startText += '  Version:     '.green + extraPadding + version + '\n'
    startText += '  Node.JS:     '.green + extraPadding + nodeVersion + '\n'
    startText += '  Environment: '.green + extraPadding + env + '\n'
    startText += '  Engine:      '.green + extraPadding + enginesInfo + '\n'

    if (config.get('api.enabled') === true) {
      startText +=
        '  API:         '.green +
        extraPadding +
        config.get('api.host') +
        ':' +
        config.get('api.port') +
        '\n'
    } else {
      startText +=
        '  API:         '.green + extraPadding + 'Disabled'.red + '\n'
      startText += '  ----------------------------\n'
    }

    if (env !== 'test') {
      startText +=
        '\n\n  Copyright ' +
        String.fromCharCode(169) +
        ' 2015-' +
        new Date().getFullYear() +
        ' DADI+ Limited (https://dadi.tech)'.white +
        '\n'
      console.log(startText)
    }
  })
}

function onError (err) {
  if (err.code === 'EADDRINUSE') {
    var message =
      "Can't connect to local address, is something already listening on port " +
      config.get('server.port') +
      '?'
    err.localIp = config.get('server.host')
    err.localPort = config.get('server.port')
    err.message = message
    console.log(err)
    console.log()
    process.exit(0)
  }
}
