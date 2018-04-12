'use strict'

const async = require('async')
const formatError = require('@dadi/format-error')
const fs = require('fs')
const path = require('path')
const marked = require('marked')
const meta = require('@dadi/metadata')
const recursive = require('recursive-readdir')
const yaml = require('js-yaml')

const help = require(path.join(__dirname, '../help'))

const MarkdownProvider = function () {}

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
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
MarkdownProvider.prototype.load = function (requestUrl, done) {
  try {
    const sourcePath = path.normalize(this.schema.datasource.source.path)

    // Ignore files without the correct extension
    recursive(sourcePath, (err, filepaths) => {
      if (err && err.code === 'ENOENT') {
        const data = {
          results: [],
          errors: [formatError.createWebError('0006', { sourcePath })]
        }

        return done(null, data)
      }

      // Filter out only files with the correct extension
      filepaths = filepaths.filter(i =>
        new RegExp('.' + this.extension + '$', 'i').test(i)
      )

      // Process each file
      async.map(filepaths, this.readFileAsync, (err, readResults) => {
        if (err) return done(err, null)

        this.parseRawDataAsync(readResults, (err, posts) => {
          if (err) return done(err)

          const params = this.datasourceParams
            ? this.datasourceParams
            : this.schema.datasource

          const sort = this.processSortParameter(params.sort)
          const search = params.search
          const count = params.count
          const fields = params.fields || []
          const filter = params.filter
          const page = params.page || 1

          let metadata = []

          // apply search
          posts = help.where(posts, search)

          // apply filter
          posts = posts.filter(post => {
            if (help.where([post.attributes], filter).length > 0) {
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

          done(null, { results: posts, metadata: metadata || null })
        })
      })
    })
  } catch (ex) {
    done(ex, null)
  }
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

MarkdownProvider.prototype.readFileAsync = function (filename, callback) {
  fs.readFile(filename, 'utf8', function (err, data) {
    return callback(err, { _name: filename, _contents: data })
  })
}

MarkdownProvider.prototype.parseRawDataAsync = function (data, callback) {
  const yamlRegex = /---[\n\r]+([\s\S]*)[\n\r]+---[\n\r]+([\s\S]*)/
  const posts = []

  for (let i = 0; i < data.length; i++) {
    const bits = yamlRegex.exec(data[i]._contents)
    let attributes = []

    try {
      attributes = yaml.safeLoad(bits[1] || '')
    } catch (err) {
      err.message = `Error in file '${data[i]._name}': ${err.message}`
      callback(err)
    }

    if (attributes) {
      const contentText = bits[2] || ''
      const contentHtml = marked(contentText)
      const parsedPath = path.parse(data[i]._name)

      // Some info about the file
      attributes._id = parsedPath.name
      attributes._ext = parsedPath.ext
      attributes._loc = data[i]._name
      attributes._path = parsedPath.dir
        .replace(path.normalize(this.schema.datasource.source.path), '')
        .replace(/^\/|\/$/g, '')
        .split('/')

      attributes._path = attributes._path.filter(Boolean)
      attributes._path = attributes._path.length === 0 ? null : attributes._path

      posts.push({
        attributes,
        original: data[i]._contents,
        contentText,
        contentHtml
      })
    }
  }

  callback(null, posts)
}

module.exports = MarkdownProvider
