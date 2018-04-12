'use strict'

const path = require('path')
const request = require('request')
const FeedParser = require('feedparser')
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))

const RSSProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
RSSProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.processSchemaParams = false
  // this.setAuthStrategy()
}

/**
 * buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
RSSProvider.prototype.buildEndpoint = function buildEndpoint (req) {
  this.endpoint = this.schema.datasource.source.endpoint
}

/**
 * buildQueryParams
 *
 * @return {obj}
 */
RSSProvider.prototype.buildQueryParams = function buildQueryParams () {
  const params = {}
  const datasource = this.schema.datasource

  params.count = datasource.count
  params.fields = ''

  if (Array.isArray(datasource.fields)) {
    params.fields = datasource.fields.join(',')
  } else if (datasource.fields && Object.keys(datasource.fields).length) {
    params.fields = Object.keys(datasource.fields).join(',')
  }

  for (let f in datasource.filter) {
    params[f] = datasource.filter[f]
  }

  return params
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
RSSProvider.prototype.load = function load (requestUrl, done) {
  try {
    const context = this
    // const queryParams = this.buildQueryParams()

    this.cacheKey = [
      this.endpoint,
      encodeURIComponent(JSON.stringify(this.schema.datasource))
    ].join('+')
    this.dataCache = new DatasourceCache()

    const cacheOptions = {
      name: this.datasource.name,
      caching: this.schema.datasource.caching,
      cacheKey: this.cacheKey
    }

    this.dataCache.getFromCache(cacheOptions, cachedData => {
      if (cachedData) {
        try {
          cachedData = JSON.parse(cachedData.toString())
          return done(null, cachedData)
        } catch (err) {
          console.error(
            'RSS: cache data incomplete, making HTTP request: ' +
              err +
              '(' +
              cacheOptions.cacheKey +
              ')'
          )
        }
      }

      const items = []
      const feedparser = new FeedParser()

      const req = request(this.endpoint, {
        pool: false,
        headers: {
          'user-agent': 'DADI/Web',
          accept: 'text/html,application/xhtml+xml'
        }
      })

      // request events
      req.on('error', done)

      req.on('response', res => {
        if (res.statusCode !== 200) return done('Bad status code', null)
        res.pipe(feedparser)
      })

      // feedparser events
      feedparser.on('error', done)

      feedparser.on('end', () => {
        const cacheOptions = {
          name: this.datasource.name,
          caching: this.schema.datasource.caching,
          cacheKey: this.cacheKey
        }

        context.dataCache.cacheResponse(
          cacheOptions,
          JSON.stringify(items),
          () => {}
        )
        return done(null, items)
      })

      feedparser.on('readable', function () {
        let item
        while ((item = this.read())) {
          items.push(item)
        }
      })
    })
  } catch (ex) {
    done(ex, null)
  }
}

/**
 * processRequest - called on every request, call buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
RSSProvider.prototype.processRequest = function processRequest (req) {
  this.buildEndpoint(req)
}

/**
 * setAuthStrategy
 *
 * @return {void}
 */
RSSProvider.prototype.setAuthStrategy = function setAuthStrategy () {
  // TODO: identify all required authentication methods and implement them here
  // - Basic HTTP? (Not usually supported)
  // - Query string param?
  // - Bearer Token?
}

module.exports = RSSProvider
