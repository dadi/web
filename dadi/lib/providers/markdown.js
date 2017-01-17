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
  // TODO: implement sort
  return {}

  // let sort = {}
  //
  // if (typeof obj !== 'object' || obj === null) return sort
  //
  // if (_.isArray(obj)) {
  //   _.each(obj, (value, key) => {
  //     if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
  //       sort[value.field] = (value.order === 'asc') ? 1 : -1
  //     }
  //   })
  // } else if (obj.hasOwnProperty('field') && obj.hasOwnProperty('order')) {
  //   sort[obj.field] = (obj.order === 'asc') ? 1 : -1
  // } else {
  //   sort = obj
  // }
  //
  // return sort
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
    const contentText = bits[2] || '';
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
