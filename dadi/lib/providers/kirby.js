// http://127.0.0.1:3001/en/necker-island
'use strict'

const fs = require('fs')
// const mime = require('mime')
const path = require('path')
const readdirp = require('readdirp')

const visiblePageRe = /^\d+-/

const KirbyProvider = function () {}

KirbyProvider.prototype.destroy = function () {}

/**
 * initialise - initialises the datasource provider
 *
 * @param  {obj} datasource - the datasource to which this provider belongs
 * @param  {obj} schema - the schema that this provider works with
 * @return {void}
 */
KirbyProvider.prototype.initialise = function (datasource, schema) {
  this.datasource = datasource
  this.schema = schema
}

/**
 * load - loads data from the datasource
 *
 * @param  {string} requestUrl - url of the web request (not used)
 * @param  {fn} done - callback on error or completion
 * @return {void}
 */
KirbyProvider.prototype.load = function (requestUrl, done) {
  let data = []

  const contentPath = path.resolve(this.schema.datasource.source.path)

  console.log('contentPath:', contentPath)

  getStuff(contentPath, data).then(() => {
    return done(null, { results: Array.isArray(data) ? data : [data] })
  })

  function getStuff (thePath, theCollection, depth) {
    return new Promise((resolve, reject) => {
      let options = {
        root: thePath,
        fileFilter: '*.txt',
        depth: depth || 1,
        entryType: 'files',
        lstat: true
      }

      let parents = []

      readdirp(options)
        .on('data', entry => {
          if (entry.fullParentDir !== options.root) {
            parents.push(entry)
          }
        })
        .on('end', () => {
          if (parents.length === 0) {
            return resolve(theCollection)
          }

          for (let i = 0; i < parents.length; i++) {
            buildPage(parents[i]).then(page => {
              if (page) theCollection.push(page)

              if (i === parents.length - 1) {
                return resolve(theCollection)
              }
            })
          }
        })
    })
  }

  function buildPage (entry) {
    return new Promise((resolve, reject) => {
      let key = entry.parentDir
      let directory = entry.fullParentDir
      let isVisible = visiblePageRe.test(key)
      let url = '/' + key.replace(visiblePageRe, '')
      let template = entry.name.replace('.txt', '')

      let page = {
        attributes: {
          directory: directory,
          key: key,
          template: template,
          visible: isVisible
        },
        url: url,
        children: []
      }

      let raw = fs.readFileSync(entry.fullPath).toString()

      // explode all fields by the line separator
      let fields = raw.split(/\n----\s*\n*/)

      let attributes = {}

      // loop through all fields and add them to the content
      fields.forEach(field => {
        let pos = field.indexOf(':')
        let key = field.substring(0, pos).toLowerCase()
        let value =
          field.substring(pos + 1) === '\n'
            ? null
            : field.substring(pos + 1).trim()

        if (value) attributes[key] = value
      })

      page = Object.assign({}, page, attributes)

      page.render = function (chunk, context, bodies, params) {
        var dust = require('dustjs-linkedin')
        var re = new RegExp(`${this.attributes.template}$`)

        let template = Object.keys(dust.cache).filter(key => {
          return re.test(key) ? key : null
        })

        if (template.length === 0) {
          return chunk.write(`Template not found: ${this.attributes.template}`)
        }

        dust.render(template[0], context, (err, out) => {
          if (err) console.log(err)
          return chunk.write(out)
        })
      }

      return getStuff(directory, page.children).then(() => {
        return resolve(page)
      })
    })
  }

  // if (Array.isArray(data)) {
  //   const sort = this.schema.datasource.sort
  //   const search = this.schema.datasource.search
  //   const count = this.schema.datasource.count
  //   const fields = this.schema.datasource.fields || []
  //
  //   if (search) data = _.where(data, search)
  //
  //   // apply a filter
  //   data = _.where(data, this.schema.datasource.filter)
  //
  //   // Sort by field (with date support)
  //   if (sort && Object.keys(sort).length > 0) {
  //     Object.keys(sort).forEach(field => {
  //       data = _.sortBy(data, post => {
  //         const value = post[field]
  //         const valueAsDate = new Date(value)
  //         return valueAsDate.toString() !== 'Invalid Date'
  //           ? +valueAsDate
  //           : value
  //       })
  //       if (sort[field] === -1) {
  //         data = data.reverse()
  //       }
  //     })
  //   }
  //
  //   if (count) data = _.first(data, count)
  //   if (fields && !_.isEmpty(fields)) {
  //     data = _.chain(data).selectFields(fields.join(',')).value()
  //   }
  // }

  // done(null, { results: Array.isArray(data) ? data : [data] })
}

module.exports = KirbyProvider
