'use strict'

const fs = require('fs')
const mime = require('mime')
const marked = require('marked')
const path = require('path')
const readdirp = require('readdirp')
const templateStore = require(path.join(__dirname, '/../templates/store'))
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
  this.pageKey =
    this.datasourceParams.filter && this.datasourceParams.filter['key']

  const contentPath = path.resolve(this.schema.datasource.source.path)

  this.buildPages(contentPath, []).then(data => {
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

    return done(null, { results: data })
  })
}

KirbyProvider.prototype.buildPages = function (thePath, theCollection, depth) {
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
          if (this.pageKey) {
            if (entry.fullParentDir.indexOf(this.pageKey) > -1) {
              parents.push(entry)
            }
          } else {
            parents.push(entry)
          }
        }
      })
      .on('end', () => {
        if (parents.length === 0) {
          return resolve(theCollection)
        }

        for (let i = 0; i < parents.length; i++) {
          this.buildPage(parents[i]).then(page => {
            if (page) theCollection.push(page)

            if (i === parents.length - 1) {
              return resolve(theCollection)
            }
          })
        }
      })
  })
}

KirbyProvider.prototype.buildPage = function (entry) {
  return new Promise((resolve, reject) => {
    let key = entry.parentDir
    let directory = entry.fullParentDir
    let isVisible = visiblePageRe.test(key)
    let url = '/' + key.replace(visiblePageRe, '')
    let template = entry.name.replace('.txt', '')

    let page = {
      uid: key,
      attributes: {
        directory: directory,
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

      if (value) {
        attributes[key] = value

        if (key === 'body') {
          attributes['bodyHtml'] = marked(value)
        }
      }
    })

    page = Object.assign({}, page, attributes)

    // add images from the same directory
    page.images = []

    readdirp({
      root: directory,
      entryType: 'files',
      fileFilter: file => {
        return mime.lookup(file.fullPath) === 'image/jpeg'
      },
      lstat: false
    }).on('data', file => {
      page.images.push(
        file.fullPath.replace(process.cwd(), '').replace('workspace/', '')
      )
    })

    // render function
    // TODO: make template engine agnostic
    page.render = function (chunk, context, bodies, params) {
      let re = new RegExp(`${this.attributes.template}$`)
      let dust = templateStore.engines['dust'].handler.getCore()

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

    return this.buildPages(directory, page.children).then(() => {
      return resolve(page)
    })
  })
}

/**
 * processRequest - called on every request, rebuild buildEndpoint
 *
 * @param  {obj} req - web request object
 * @return {void}
 */
KirbyProvider.prototype.processRequest = function (datasourceParams) {
  this.datasourceParams = datasourceParams
}

module.exports = KirbyProvider
