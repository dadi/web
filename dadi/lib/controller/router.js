/*
REWRITE INFO:
https://github.com/tinganho/connect-modrewrite
*/
var _ = require('underscore')
var es = require('event-stream')
var fs = require('fs')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var toobusy = require('toobusy-js')
var url = require('url')

var config = require(path.resolve(path.join(__dirname, '/../../../config')))
var help = require(path.join(__dirname, '/../help'))
var log = require('@dadi/logger')
var rewrite = require(path.join(__dirname, '/rewrite'))

var Datasource = require(path.join(__dirname, '/../datasource'))
var Preload = require(path.join(__dirname, '../datasource/preload'))
var RouteValidator = require(path.join(__dirname, '../datasource/route-validator'))

var rewriteFunction = null

var Router = function (server, options) {
  log.info({module: 'router'}, 'Router logging started.')

  this.data = {}
  this.params = {}
  this.constraints = {}
  this.options = options
  this.handlers = []
  this.rules = []

  this.rewritesFile = config.get('rewrites.path') === '' ? null : path.resolve(config.get('rewrites.path'))
  this.rewritesDatasource = config.get('rewrites.datasource')
  this.loadDatasourceAsFile = config.get('rewrites.loadDatasourceAsFile')

  this.server = server

  // set latency values
  if (config.get('toobusy.enabled')) {
    toobusy.maxLag(config.get('toobusy.maxLag'))
    toobusy.interval(config.get('toobusy.interval'))
  }

  // load the route constraint specifications if they exist
  try {
    var constraintsPath = path.join(options.routesPath, '/constraints.js')
    delete require.cache[constraintsPath]
    this.handlers = require(constraintsPath)
  } catch (err) {
    log.info({module: 'router'}, 'No route constraints loaded, file not found (' + constraintsPath + ')')
  }
}

Router.prototype.loadRewrites = function (options, done) {
  var self = this
  self.rules = []

  if (self.rewritesDatasource && self.loadDatasourceAsFile) {
    // Get the rewritesDatasource
    new Datasource(self.rewritesDatasource, self.rewritesDatasource, this.options).init(function (err, ds) {
      if (err) {
        log.error({module: 'router'}, err)
      }

      // var endpointParts = ds.source.endpoint.split('/')
      //
      // var api = new DadiAPI({
      //   uri: config.get('api.protocol') + '://' + config.get('api.host'),
      //   port: config.get('api.port'),
      //   credentials: {
      //     clientId: config.get('auth.clientId'),
      //     secret: config.get('auth.secret')
      //   },
      //   version: endpointParts[0],
      //   database: endpointParts[1]
      // })

      function refreshRewrites (cb) {
        // Get redirects from API collection
        var freshRules = []
        ds.provider.load(null, function (err, response) {
          if (err) {
            console.log('Error loading data in Router Rewrite module')
            console.log(err)
            return cb(null)
          }

          if (response) {
            response = JSON.parse(response)
          }

          if (response.results) {
            // api.in(self.rewritesDatasource).find().then(function (response)
            var idx = 0

            _.each(response.results, function (rule) {
              freshRules.push(rule.rule + ' ' + rule.replacement + ' ' + '[R=' + rule.redirectType + ',L]')
              idx++
              if (idx === response.results.length) {
                self.rules = freshRules
                log.info('Loaded ' + idx + ' rewrites')
                if (rewriteFunction) rewriteFunction = rewrite(self.rules)
                if (cb) return cb(null)
              }
            })
          } else {
            if (cb) return cb(null)
          }
        })
      }

      setInterval(refreshRewrites, config.get('rewrites.datasourceRefreshTime') * 60 * 1000)
      refreshRewrites(done)
    })
  } else if (self.rewritesFile) {
    var rules = []
    var stream = fs.createReadStream(self.rewritesFile, {encoding: 'utf8'})

    stream.pipe(es.split('\n'))
      .pipe(es.mapSync(function (data) {
        if (data !== '') rules.push(data)
      })
    )

    stream.on('error', function (err) {
      log.error({module: 'router'}, 'No rewrites loaded, file not found (' + self.rewritesFile + ')')
      done(err)
    })

    stream.on('end', function () {
      self.rules = rules.slice(0)
      done(null)
    })
  } else {
    done(null)
  }
}

/**
 *  Attaches a function from /{routesPath}/constraints.js to the specified route
 *  @param {String} route
 *  @param {String} fn
 *  @return undefined
 *  @api public
 */
Router.prototype.constrain = function (route, constraint) {
  // add constraint from /{routesPath}/constraints.js if it exists
  if (this.handlers[constraint]) {
    this.constraints[route] = this.handlers[constraint]
    log.info({module: 'router'}, "Added route constraint function '%s' for '%s'", constraint, route)
  } else {
    var error = "Route constraint '" + constraint + "' not found. Is it defined in '" + this.options.routesPath + "/constraints.js'?"
    var err = new Error(error)
    err.name = 'Router'
    log.error({module: 'router'}, error)
    throw (err)
  }

  return
}

/**
 * Validates the current route against existing data or business rules
 */
Router.prototype.validate = function (route, req, res) {
  return new Promise((resolve, reject) => {
    // test the supplied url against each matched route.
    // for example: does "/test/2" match "/test/:page"?
    var pathname = url.parse(req.url, true).pathname
    var regex = pathToRegexp(route.path)
    var match = regex.exec(pathname)

    // allow a 404 to sail through this
    if (route.path === '/404') {
      return resolve()
    }

    // move to the next route if no match
    if (!match) {
      return reject('')
    }

    // get all the dynamic keys from the route
    // i.e. anything that starts with ":" -> "/news/:title"
    this.injectRequestParams(match, regex.keys, req)

    var paramsPromises = []

    _.each(route.params, (param) => {
      paramsPromises.push(new Promise((resolve, reject) => {
        if (_.isEmpty(route.params)) {
          return resolve('')
        }

        if (param.preload && param.preload.source) {
          var data = Preload().get(param.preload.source)
          var matches = _.filter(data, (record) => {
            return record[param.preload.field] === req.params[param.param]
          })

          if (!_.isEmpty(matches)) {
            return resolve('')
          } else {
            return reject('Parameter "' + param.param + '=' + req.params[param.param] + '" not found in preloaded data "' + param.preload.source + '"')
          }
        } else if (param.in && _.isArray(param.in)) {
          if (req.params[param.param] && _.contains(param.in, req.params[param.param])) {
            return resolve('')
          } else {
            return reject('Parameter "' + param.param + '=' + req.params[param.param] + '" not found in array "' + param.in + '"')
          }
        } else if (param.fetch) {
          var routeValidator = new RouteValidator(route, param, this.options)
          routeValidator.get(req).then(() => {
            return resolve('')
          }).catch((err) => {
            return reject('Parameter "' + param.param + '=' + req.params[param.param] + '" not found in datasource "' + param.fetch + '". ' + err)
          })
        }
      }))
    })

    Promise.all(paramsPromises).then((result) => {
      this.testConstraint(route.path, req, res, (passed) => {
        if (passed) {
          return resolve('')
        } else {
          return reject('')
        }
      })
    }).catch((err) => {
      log.warn(err)
      return reject('')
    })
  })
}

/**
 *
 */
Router.prototype.injectRequestParams = function (matchedRoute, keys, req) {
  req.params = {}

  // [ '/test/1/2', '1', '2', index: 0, input: '/test/1/2' ]
  matchedRoute.forEach((property, index) => {
    // get the dynamic route key that is
    // at the same index as we are in the loop
    var keyOpts = keys[index] || {}

    // NOTE: the value for the key is found one slot ahead of the current index, because the first property
    // was the full matched string e.g. /test/2 and the values for the keys appear next

    // here we only add the key to the params if it hasn't been already
    if (matchedRoute[index + 1] && keyOpts.name && !req.params[keyOpts.name]) {
      req.params[keyOpts.name] = matchedRoute[index + 1]
    }
  })
}

/**
 *  Attaches a function from /{routesPath}/constraints.js to the specified route
 *  @param {String} route
 *  @return `true` if `route` can be handled by a route handler, or if no handler matches the route. `false`
 *  if a route handler matches but returned false when tested.
 *  @api public
 */
Router.prototype.testConstraint = function (route, req, res, callback) {
  // no constraint against this route, let's use it
  if (!this.constraints[route]) {
    return callback(true)
  }

  // if there's a constraint handler for this route, run it
  log.debug({module: 'router'}, 'Testing constraint for route "' + route + '" and URL "' + req.url + '"')

  if (typeof this.constraints[route] === 'function') {
    help.timer.start('router constraint: ' + route)

    this.constraints[route](req, res, function (result) {
      help.timer.stop('router constraint: ' + route)
      return callback(result)
    })
  } else {
    return callback(true)
  }
}

Router.prototype.loadRewriteModule = function () {
  log.info({module: 'router'}, 'Rewrite module reload.')
  log.info({module: 'router'}, this.rules.length + ' rewrites/redirects loaded.')
}

module.exports = function (server, options) {
  server.app.Router = new Router(server, options)

  // middleware which blocks requests when we're too busy
  server.app.use(function (req, res, next) {
    if (config.get('toobusy.enabled') && toobusy()) {
      res.statusCode = 503
      return res.end('HTTP Error 503 - Server Busy')
    } else {
      next()
    }
  })

  // load the rewrites from the filesystem
  server.app.Router.loadRewrites(options, function (err) {
    if (err) console.log(err)

    this.shouldCall = true
    rewriteFunction = rewrite(server.app.Router.rules)

    // determine if we need to even call
    server.app.use(function (req, res, next) {
      this.shouldCall = rewriteFunction.call(server.app.Router, req, res, next)
      if (!res.finished) next()
    })

    // load rewrites from our DS and handle them
    server.app.use(function (req, res, next) {
      if (!this.shouldCall) return next()

      log.debug({module: 'router'}, '[Router] processing: ' + req.url)

      if (!server.app.Router.rewritesDatasource || server.app.Router.loadDatasourceAsFile || server.app.Router.rewritesDatasource === '') return next()

      new Datasource('rewrites', server.app.Router.rewritesDatasource, options).init(function (err, ds) {
        if (err) {
          console.log(err)
          throw (err)
        }

        _.extend(ds.schema.datasource.filter, { 'rule': req.url })

        ds.provider.processRequest(ds.page.name, req)

        ds.provider.load(req.url, function (err, result) {
          if (err) {
            console.log('Error loading data in Router Rewrite module')
            return next(err)
          }

          if (result) {
            var results = (typeof result === 'object') ? result : JSON.parse(result)

            if (results && results.results && results.results.length > 0 && results.results[0].rule === req.url) {
              var rule = results.results[0]
              var location
              if (/:\/\//.test(rule.replacement)) {
                location = req.url.replace(rule.rule, rule.replacement)
              } else {
                location = 'http' + '://' + req.headers.host + req.url.replace(rule.rule, rule.replacement)
              }

              var headers = {
                Location: location
              }

              _.each(config.get('headers.cacheControl'), (value, key) => {
                if (rule.redirectType.toString() === key && value !== '') {
                  headers['Cache-Control'] = value
                }
              })

              res.writeHead(rule.redirectType, headers)
              res.end()
            } else {
              return next()
            }
          } else {
            return next()
          }
        })
      })
    })

    // handle generic url rewrite rules
    server.app.use(function (req, res, next) {
      var redirect = false
      var location = req.url
      var rewritesConfig = config.get('rewrites')
      var httpsEnabled = config.get('server.https.enabled')
      var protocol = httpsEnabled ? 'https' : 'http'

      // force a URL to lowercase
      if (rewritesConfig.forceLowerCase) {
        if (location !== location.toLowerCase()) {
          location = location.toLowerCase()
          redirect = true
        }
      }

      // stripIndexPages
      if (!_.isEmpty(rewritesConfig.stripIndexPages)) {
        var files = rewritesConfig.stripIndexPages
        var re = new RegExp(files.join('|'), 'gi')

        if (location.match(re)) {
          location = location.replace(re, '')
          redirect = true
        }
      }

      // force a trailing slash
      if (rewritesConfig.forceTrailingSlash) {
        var parsed = url.parse(location, true)
        if (/^([^.]*[^/])$/.test(parsed.pathname) === true) {
          location = parsed.pathname + '/' + parsed.search
          redirect = true
        }
      }

      if (redirect) {
        res.writeHead(301, {
          Location: protocol + '://' + req.headers.host + location
        })
        res.end()
      } else {
        return next()
      }
    })
  })
}

module.exports.Router = Router
