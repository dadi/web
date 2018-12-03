'use strict'

const formatError = require('@dadi/format-error')
const fs = require('fs')
const recursive = require('recursive-readdir')
const path = require('path')
const marked = require('marked')
const meta = require('@dadi/metadata')
const yaml = require('js-yaml')

const help = require(path.join(__dirname, '../help'))
const DatasourceCache = require(path.join(__dirname, '/../cache/datasource'))
const log = require('@dadi/logger')

const optionalByteOrderMark = '\\ufeff?'
const pattern =
  '^(' +
  optionalByteOrderMark +
  '(= yaml =|---)' +
  '$([\\s\\S]*?)' +
  '^(?:\\2|\\.\\.\\.)' +
  '$' +
  (process.platform === 'win32' ? '\\r?' : '') +
  '(?:\\n)?)'
const yamlRegex = new RegExp(pattern, 'm')

const MarkdownProvider = function () {
  this.dataCache = new DatasourceCache()
}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
MarkdownProvider.prototype.initialise = function (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
  this.extension = schema.datasource.source.extension
    ? schema.datasource.source.extension
    : 'md'

  this.renderHtml = datasource.source.renderHtml !== false
}

/**
 * processSortParameter
 *
 * @param  {?} obj - sort parameter
 * @return {?}
 */
MarkdownProvider.prototype.processSortParameter = function (obj) {
  let sort = {}

  if (
    typeof obj !== 'undefined' &&
    Object.keys(obj) &&
    Object.keys(obj).length > 0
  ) {
    Object.keys(obj).forEach(field => {
      const sortInteger = obj[field]

      if (sortInteger === -1 || sortInteger === 1) {
        sort[field] = sortInteger
      }
    })
  }

  return sort
}

/**
 * load - loads data form the datasource
 *
 * @param  {string} requestUrl - url of the web request
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
MarkdownProvider.prototype.load = function (requestUrl, done) {
  const sourcePath = path.normalize(this.schema.datasource.source.path)

  const params = this.datasourceParams
    ? this.datasourceParams
    : this.schema.datasource

  const sort = this.processSortParameter(params.sort)
  const search = params.search
  const count = params.count
  const fields = params.fields || []
  const filter = params.filter
  const page = params.page || 1

  const cacheOptions = {
    name: this.datasource.name,
    endpoint: sourcePath
  }

  if (this.schema.datasource.caching) {
    cacheOptions.caching = this.schema.datasource.caching
  }

  this.dataCache.getFromCache(cacheOptions, cachedData => {
    // data found in the cache, parse into JSON
    // and return to whatever called load()
    if (cachedData) {
      try {
        cachedData = JSON.parse(cachedData.toString())
        return done(null, cachedData)
      } catch (err) {
        log.error(
          'markdown: cache data incomplete, making HTTP request: ' +
            err +
            '(' +
            cacheOptions.endpoint +
            ')'
        )
      }
    }
  })

  this.readdirAsync(sourcePath)
    .then(filepaths => {
      // Ignore files without the correct extension
      filepaths = filepaths.filter(i =>
        new RegExp('.' + this.extension + '$', 'i').test(i)
      )

      return Promise.all(filepaths.map(i => this.readFileAsync(i)))
    })
    .then(files => {
      return Promise.all(files.map(i => this.parseRawDataAsync(i)))
    })
    .then(posts => {
      let metadata = []

      // apply search
      posts = help.where(posts, search)

      // apply filter
      posts = posts.filter(post => {
        if (post && help.where([post.attributes], filter).length > 0) {
          return post
        }
      })

      // Sort posts by attributes field (with date support)
      if (sort && Object.keys(sort).length > 0) {
        Object.keys(sort).forEach(field => {
          posts.sort(
            help.sortBy(field, value => {
              if (field.toLowerCase().includes('date')) {
                value = new Date(value)
              }

              return value
            })
          )

          if (sort[field] === -1) {
            posts.reverse()
          }
        })
      }

      // Count posts
      let postCount = posts.length

      // Paginate if required
      if (page && count) {
        const offset = (page - 1) * count
        posts = posts.slice(offset, offset + count)

        // Metadata for pagination
        const options = []
        options['page'] = parseInt(page)
        options['limit'] = parseInt(count)

        metadata = meta(options, parseInt(postCount))
      }

      if (fields && fields.length > 0) {
        if (Array.isArray(posts)) {
          let i = 0
          posts.forEach(document => {
            posts[i] = help.pick(posts[i], fields)
            i++
          })
        } else {
          posts = help.pick(posts, fields)
        }
      }

      const data = { results: posts, metadata: metadata || null }

      this.dataCache.cacheResponse(
        cacheOptions,
        JSON.stringify(data),
        written => {
          return done(null, data)
        }
      )
    })
    .catch(err => {
      log.error(err)

      const data = {
        results: [],
        errors: [formatError.createWebError('0006', { sourcePath })]
      }

      return done(null, data)
    })
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
MarkdownProvider.prototype.processRequest = function (datasourceParams) {
  this.datasourceParams = datasourceParams
}

MarkdownProvider.prototype.readFileAsync = function (filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve({ _name: filename, _contents: data })
      }
    })
  })
}

MarkdownProvider.prototype.readdirAsync = function (dirname) {
  return new Promise((resolve, reject) => {
    recursive(dirname, (err, filenames) => {
      if (err) {
        reject(err)
      } else {
        resolve(filenames)
      }
    })
  })
}

MarkdownProvider.prototype.parseRawDataAsync = function (post, callback) {
  return new Promise((resolve, reject) => {
    let bits = yamlRegex.exec(post._contents)

    // Attributes
    let attributes = []
    attributes = bits[bits.length - 1].replace(/^\s+|\s+$/g, '')
    attributes = yaml.safeLoad(attributes) || {}

    let contentText = post._contents.replace(bits[0], '') || ''
    let contentHtml = this.renderHtml ? marked(contentText) : ''

    // Some info about the file
    let parsedPath = path.parse(post._name)

    attributes._id = parsedPath.name
    attributes._ext = parsedPath.ext
    attributes._loc = post._name
    attributes._path = parsedPath.dir
      .replace(path.normalize(this.schema.datasource.source.path), '')
      .replace(/^\/|\/$/g, '')
      .split('/')

    attributes._path = attributes._path.filter(Boolean)
    attributes._path = attributes._path.length === 0 ? null : attributes._path

    post = {
      attributes,
      original: post._contents,
      contentText,
      contentHtml
    }

    resolve(post)
  })
}

module.exports = MarkdownProvider
