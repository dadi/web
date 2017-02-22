'use strict'

const _ = require('underscore')
const fs = require('fs')
const path = require('path')
const async = require('async')
const yaml = require('js-yaml')
const marked = require('marked')

const MarkdownProvider = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
MarkdownProvider.prototype.initialise = function initialise (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
}

/**
 * processSortParameter
 *
 * @param  {?} obj - sort parameter
 * @return {?}
 */
MarkdownProvider.prototype.processSortParameter = function processSortParameter (obj) {
  let sort = {}

  if (_.isObject(obj)) {
    _.each(obj, (sortInteger, field) => {
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
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
MarkdownProvider.prototype.load = function load (requestUrl, done) {
  try {
    const sourcePath = path.normalize(this.schema.datasource.source.path)
    const filenames = fs.readdirSync(sourcePath)
    const filepaths = filenames.map(i => path.join(sourcePath, i))

    async.map(filepaths, this.readFileAsync, (err, readResults) => {
      if (err) return done(err, null)

      this.parseRawDataAsync(readResults, (posts) => {
        const sort = this.processSortParameter(this.schema.datasource.sort)
        const search = this.schema.datasource.search
        const count = this.schema.datasource.count
        const fields = this.schema.datasource.fields || []
        const filter = this.schema.datasource.filter
        const page = this.schema.datasource.page || 1

        if (search) {
          posts = _.where(posts, search)
        }

        if (filter) {
          posts = _.filter(posts, (post) => {
            return _.where([post.metadata], filter).length > 0
          })
        }

        // Sort posts by metadata field (with date support)
        if (sort && Object.keys(sort).length > 0) {
          Object.keys(sort).forEach(field => {
            posts = _.sortBy(posts, (post) => {
              const value = post.metadata[field]
              const valueAsDate = new Date(value)
              return (valueAsDate.toString() !== 'Invalid Date')
                ? +(valueAsDate)
                : value
            })
            if (sort[field] === -1) {
              posts = posts.reverse()
            }
          })
        }

        // Paginate if required
        if (page && count) {
          const offset = (page - 1) * count
          posts = posts.slice(offset, offset + count)
        }

        if (fields && !_.isEmpty(fields)) {
          posts = _.chain(posts).selectFields(fields.join(',')).value()
        }

        done(null, { results: posts })
      })
    })
  } catch (ex) {
    done(ex, null)
  }
}

MarkdownProvider.prototype.readFileAsync = function readFileAsync (filename, callback) {
  fs.readFile(filename, 'utf8', callback)
}

MarkdownProvider.prototype.parseRawDataAsync = function parseRawDataAsync (data, callback) {
  const yamlRegex = /---[\n\r]+([\s\S]*)[\n\r]+---[\n\r]+([\s\S]*)/
  const posts = []

  for (let i = 0; i < data.length; i++) {
    const bits = yamlRegex.exec(data[i])
    const metadata = yaml.safeLoad(bits[1] || '')
    const contentText = bits[2] || ''
    const contentHtml = marked(contentText)

    posts.push({
      original: data[i],
      metadata,
      contentText,
      contentHtml
    })
  }

  callback(posts)
}

module.exports = MarkdownProvider
