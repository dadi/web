'use strict'

/**
 * @module Controller
 */
const async = require('async')
const clone = require('clone')
const debug = require('debug')('web:controller')
const getValue = require('get-value')
const path = require('path')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config.js'))
const help = require(path.join(__dirname, '/../help'))
const log = require('@dadi/logger')

const Datasource = require(path.join(__dirname, '/../datasource'))
const Event = require(path.join(__dirname, '/../event'))
const Providers = require(path.join(__dirname, '/../providers'))
const View = require(path.join(__dirname, '/../view'))
const DebugView = require(path.join(__dirname, '/../debug'))
const Send = require(path.join(__dirname, '/../view/send'))
const Cache = require(path.join(__dirname, '/../cache'))

/**
 *
 */
const Controller = function (page, options, meta, engine, cache) {
  if (!page) throw new Error('Page instance required')

  this.page = page

  this.options = options || {}
  this.meta = meta || {}
  this.engine = engine
  this.cacheLayer = Cache(cache)

  this.datasources = {}
  this.events = []
  this.preloadEvents = []

  this.page.globalPostProcessors = config.get('globalPostProcessors') || []
  this.page.globalEvents = config.get('globalEvents') || []

  this.attachDatasources(err => {
    if (err) {
      log.error({ module: 'controller' }, err)
      throw err
    }
  })

  this.attachEvents(() => {})
}

/**
 *
 */
Controller.prototype.attachDatasources = function (done) {
  if (this.page.datasources.length === 0) return done(null)

  let i = 0

  this.page.datasources.forEach(datasource => {
    new Datasource(this.page, datasource, this.options).init((err, ds) => {
      if (err) return done(err)

      this.datasources[ds.schema.datasource.key] = ds

      if (++i === this.page.datasources.length) {
        return done(null)
      }
    })
  })
}

/**
 *
 */
Controller.prototype.attachEvents = function (done) {
  let event

  this.page.preloadEvents.forEach(eventName => {
    event = new Event(this.page.name, eventName, this.options)
    this.preloadEvents.push(event)
  })

  this.page.events.concat(this.page.globalEvents).forEach(eventName => {
    event = new Event(this.page.name, eventName, this.options)
    this.events.push(event)
  })

  done()
}

/**
 * Checks the supplied data object for results for each of the current page's "requiredDatasources"
 *
 * @param {Object} data - the data loaded by the datasources and events
 * @returns {Boolean} - false if at least one required datasource has no results, otherwise true
 */
Controller.prototype.requiredDataPresent = function (data) {
  if (!data) return false
  if (this.page.requiredDatasources.length === 0) return true

  return this.page.requiredDatasources.every(datasource => {
    // data doesn't exist
    if (!data[datasource]) return false

    const content = data[datasource]

    if (Array.isArray(content)) {
      // it's an empty array
      if (content.length === 0) {
        return false
      }
    } else {
      // it's an object with no properties
      if (Object.keys(content).length === 0) {
        return false
      }
    }

    // it's an empty results array (likely from DADI API)
    if (
      content.results &&
      Array.isArray(content.results) &&
      content.results.length === 0
    ) {
      return false
    }

    // it's an object with properties, an array with at least one item, or
    // an object containing a "results" array with at least one item
    return true
  })
}

/**
 *
 */
Controller.prototype.buildInitialViewData = function (req) {
  let data = {}

  // data helpers
  data.has = function (node) {
    return this[node] !== undefined
  }

  data.hasResults = function (node) {
    return (
      this.has(node) &&
      this[node].results !== undefined &&
      this[node].results.length > 0
    )
  }

  const urlData = url.parse(
    `${req.protocol}://${req.headers.host}${req.url}`,
    true
  )

  data.query = urlData.query
  data.params = {}
  data.page = this.meta
  data.page.name = this.page.name

  data.url = {
    protocol: urlData.protocol,
    hostname: urlData.hostname,
    host: urlData.host,
    port: urlData.port,
    path: urlData.path,
    pathname: urlData.pathname,
    href: urlData.href
  }

  // add request params (params from the path, e.g. /:make/:model)
  // add query params (params from the querystring, e.g. /reviews?page=2)
  data.params = Object.assign({}, req.params, data.query)

  if (req.error) data.error = req.error

  // add id component from the request
  if (req.params.id) data.id = decodeURIComponent(req.params.id)

  // allow debug view using ?debug
  data.debugView = false

  if (
    config.get('allowDebugView') &&
    typeof urlData.query.debug !== 'undefined'
  ) {
    data.debugView = urlData.query.debug || true
  }

  // Legacy ?json=true
  if (config.get('allowDebugView') && urlData.query.json) {
    data.debugView = 'json'
  }

  data.global = config.has('global') ? config.get('global') : {} // global values from config
  data.debug = config.get('debug')

  if (config.get('security.csrf')) {
    data.csrfToken = req.csrfToken()
  }

  delete data.query.debug
  delete data.params.debug

  return data
}

/**
 *
 */
Controller.prototype.process = function process (req, res, next) {
  debug('%s %s', req.method, req.url)
  help.timer.start(req.method.toLowerCase())

  let data = this.buildInitialViewData(req)

  const statusCode = res.statusCode || 200
  const view = new View(req.url, this.page)

  let done = Send.html(req, res, next, statusCode, this.page.contentType)

  this.loadData(req, res, data, (err, loadedData, dsResponse) => {
    if (err) {
      if (err.statusCode && err.statusCode === 404) return next()
      return done(err)
    }

    // return 404 if requiredDatasources contain no data
    if (!this.requiredDataPresent(loadedData)) {
      return next()
    }

    // If we received a response back from the datasource, and
    // not just the data, send the whole response back
    if (dsResponse && dsResponse.statusCode === 202) {
      done = Send.json(dsResponse.statusCode, res, next)
      return done(null, loadedData)
    }

    help.timer.stop(req.method.toLowerCase())

    view.setData(loadedData)

    view.render((err, result, unprocessed) => {
      if (err) return next(err)

      if (data.debugView) {
        return DebugView(req, res, next, view, this)(null, result, unprocessed)
      } else {
        return done(null, result)
      }
    })
  })
}

function hasAttachedDatasources (datasources) {
  return typeof datasources === 'object' && Object.keys(datasources).length > 0
}

/**
 *
 */
Controller.prototype.post = function (req, res, next) {
  return this.process(req, res, next)
}

/**
 *
 */
Controller.prototype.get = function (req, res, next) {
  return this.process(req, res, next)
}

/**
 *
 */
Controller.prototype.head = function (req, res, next) {
  return this.get(req, res, next)
}

Controller.prototype.loadEventData = function (events, req, res, data, done) {
  // return the global data object, no events to run
  if (Object.keys(events).length === 0) {
    return done(null, data)
  }

  let queue = Promise.resolve(true)

  events.forEach(event => {
    queue = queue.then(() => {
      return new Promise((resolve, reject) => {
        help.timer.start('event: ' + event.name)

        // add a random value to the data obj so we can check if an
        // event has sent back the obj - in which case we assign it back
        // to itself
        data.timestamp = new Date().getTime()

        event.run(req, res, data, (err, result) => {
          help.timer.stop('event: ' + event.name)

          if (err) return reject(err)

          // if we get data back with the same timestamp property,
          // reassign it to our global data object to avoid circular JSON
          if (
            result &&
            result.timestamp &&
            result.timestamp === data.timestamp
          ) {
            data = result
          } else if (result) {
            // add the result to our global data object
            data[event.name] = result
          }

          return resolve(data)
        })
      })
    })
  })

  return queue.then(() => done(null, data)).catch(err => done(err))
}

Controller.prototype.loadData = function (req, res, data, done) {
  const self = this

  const primaryDatasources = {}
  const chainedDatasources = {}

  debug('datasources %o', Object.keys(this.datasources))

  Object.keys(this.datasources).forEach(key => {
    let ds = this.datasources[key]

    if (ds.chained) {
      chainedDatasources[key] = clone(ds)
    } else {
      primaryDatasources[key] = clone(ds)
    }
  })

  debug(
    'loadData %o %o',
    Object.keys(primaryDatasources),
    Object.keys(chainedDatasources)
  )

  help.timer.start('load data')

  async.waterfall(
    [
      // Run PreLoad Events
      function (callback) {
        help.timer.start('preload data')
        self.loadEventData(
          self.preloadEvents,
          req,
          res,
          data,
          (err, result) => {
            if (err) return done(err)
            help.timer.stop('preload data')
            callback(null)
          }
        )
      },

      // Run datasources
      function (callback) {
        if (!hasAttachedDatasources(self.datasources)) {
          callback(null)
        }

        let queue = async.queue((ds, cb) => {
          if (ds.endpointEvent) {
            ds.endpointEvent.run(req, res, data, (err, endpoint) => {
              if (err) return done(err)
              ds.schema.datasource.source.endpoint = endpoint
            })
          }

          if (ds.filterEvent) {
            ds.filterEvent.run(req, res, data, (err, filter) => {
              if (err) return done(err)
              ds.schema.datasource.filterEventResult = filter
            })
          }

          help.timer.start('datasource: ' + ds.name)

          ds.provider = new Providers[ds.source.type]()
          ds.provider.initialise(ds, ds.schema)

          processSearchParameters(ds.schema.datasource.key, ds, req)

          /**
           * Call the data provider's load method to obtain data
           * for this datasource
           * @returns err, {Object} result, {Object} dsResponse
           */
          ds.provider.load(req.url, (err, result, dsResponse) => {
            if (err) return done(err)

            help.timer.stop('datasource: ' + ds.name)

            ds.provider = null

            if (dsResponse) return done(null, result, dsResponse)

            if (result) data[ds.schema.datasource.key] = result

            cb()
          })
        }, 1)

        // queue finished
        queue.drain = function () {
          callback(null)
        }

        // add each primary datasource to the queue for processing
        Object.keys(primaryDatasources).forEach(key => {
          queue.push(primaryDatasources[key])
        })
      },

      // Run chained datasources
      function (callback) {
        self.processChained(chainedDatasources, data, req, (err, result) => {
          if (err) return done(err)
          callback(null)
        })
      },

      // Run events
      function (callback) {
        self.loadEventData(self.events, req, res, data, (err, result) => {
          if (err) return done(err)
          callback(null)
        })
      }
    ],
    // final results
    function (err) {
      help.timer.stop('load data')
      done(err, data)
    }
  )
}

Controller.prototype.processChained = function (
  chainedDatasources,
  data,
  req,
  done
) {
  let idx = 0

  if (Object.keys(chainedDatasources).length === 0) {
    return done(null, data)
  }

  Object.keys(chainedDatasources).forEach(chainedKey => {
    let chainedDatasource = chainedDatasources[chainedKey]
    let datasourceToLocate = chainedDatasource.chained.datasource

    debug('datasource (chained): %s > %s', datasourceToLocate, chainedKey)

    help.timer.start('datasource: ' + chainedDatasource.name + ' (chained)')

    if (!data[datasourceToLocate]) {
      const message =
        "Chained datasource '" +
        chainedDatasource.name +
        "' expected to find data from datasource '" +
        datasourceToLocate +
        "'."
      let err = new Error()
      err.message = message
      log.warn({ module: 'controller' }, message)
      return done(err)
    }

    // find the value of the parameter in the returned data
    // to use in the chained datasource
    let outputParam = chainedDatasource.chained.outputParam
    let param = this.getParameterValue(data[datasourceToLocate], outputParam)

    // does the parent page require no cache?
    if (data.query.cache === 'false') {
      chainedDatasource.schema.datasource.cache = false
    }

    if (this.page.passFilters && chainedDatasource.schema.datasource.paginate) {
      chainedDatasource.schema.datasource.page =
        data.query.page || req.params.page || 1
    }

    // if the outputParam has no 'target' property,
    // it's destined for the filter
    outputParam.target = outputParam.target || 'filter'

    let endpoint = chainedDatasource.schema.datasource.source.endpoint

    if (outputParam.field && param) {
      if (outputParam.target === 'endpoint') {
        const placeholderRegex = new RegExp('{' + outputParam.field + '}', 'ig')
        endpoint = endpoint.replace(placeholderRegex, param)
      } else {
        chainedDatasource.schema.datasource.filter[outputParam.field] = param
      }
    }

    chainedDatasource.schema.datasource.source.endpoint = endpoint

    // if the datasource specified a query, add it to the existing filter
    // by looking for the placeholder value
    if (outputParam.query) {
      const placeholder = '"{' + chainedDatasource.chained.datasource + '}"'
      let filter = JSON.stringify(chainedDatasource.schema.datasource.filter)
      let q = JSON.stringify(outputParam.query)

      if (typeof param !== 'number') {
        param = '"' + param + '"'
      }

      q = q.replace(/"\{param\}"/i, param)

      filter = filter.replace(placeholder, q)

      chainedDatasource.schema.datasource.filter = JSON.parse(filter)
    }

    chainedDatasource.provider = new Providers[chainedDatasource.source.type]()
    chainedDatasource.provider.initialise(
      chainedDatasource,
      chainedDatasource.schema
    )

    chainedDatasource.provider.buildEndpoint(
      chainedDatasource.schema.datasource
    )

    debug(
      'datasource (load): %s %s',
      chainedDatasource.name,
      chainedDatasource.provider.endpoint
    )

    chainedDatasource.provider.load(req.url, (err, chainedData) => {
      if (err) log.error({ module: 'controller' }, err)

      help.timer.stop('datasource: ' + chainedDatasource.name + ' (chained)')

      // TODO: simplify this, doesn't require a try/catch
      if (chainedData) {
        try {
          data[chainedKey] = chainedData
        } catch (e) {
          log.error({ module: 'controller' }, e)
        }
      }

      idx++

      if (idx === Object.keys(chainedDatasources).length) {
        return done(null, data)
      }
    })
  })
}

/**
 * Gets the value of the specified parameter from the specified source
 *
 * @param {Object} object - the object that holds the data to be searched
 * @param {Object} parameter - contains the type and path of the required parameter
 * @returns {String|Number} the value associated with the specified parameter, or null
 */
Controller.prototype.getParameterValue = function (object, parameter) {
  let value = null
  value = getValue(object, parameter.param)

  if (value) {
    if (parameter.type && parameter.type === 'Number') {
      value = Number(value)
    } else {
      value = encodeURIComponent(value)
    }
  }

  return value
}

function processSearchParameters (key, datasource, req) {
  // process each of the datasource's requestParams, testing for their existence
  // in the querystring's request params e.g. /car-reviews/:make/:model
  datasource.processRequest(key, req)
}

module.exports = function (page, options, meta, engine) {
  return new Controller(page, options, meta, engine)
}

module.exports.Controller = Controller
