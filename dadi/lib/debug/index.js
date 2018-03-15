const url = require('url')
const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const help = require(path.join(__dirname, '/../help'))

const CircularJSON = require('circular-json')

module.exports = function (req, res, next, view, page) {
  return function (err, result) {
    if (err) return next(err)

    const version = help.getVersion()
    const mode = view.data.debugView
    delete view.data.debugView

    switch (mode) {
      case 'template':
        // delete template.engine

        Send.json(200, res, next)(null, view.template)
        break
      case 'json':
        Send.json(200, res, next)(null, view.data)
        break
      case 'page':
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(page.page, null, 2)
          })
        )
        break
      case 'headers':
        Send.json(200, res, next)(null, req.headers)
        break
      case 'ds':
        let dss = {}
        for (var key in page.datasources) {
          dss[key] = {
            schema: page.datasources[key].schema.datasource,
            endpoint: page.datasources[key].provider.endpoint,
            endpointEvent: page.datasources[key].endpointEvent,
            filterEvent: page.datasources[key].filterEvent,
            requestParams: page.datasources[key].requestParams,
            chained: page.datasources[key].chained
          }
        }

        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(dss, null, 2)
          })
        )
        break
      case 'url':
        res.setHeader('Content-Type', 'application/json')
        res.end(
          CircularJSON.stringify(
            {
              url: url.parse(`${req.protocol}://${req.headers.host}${req.url}`),
              params: view.data.params,
              query: view.data.query
            },
            null,
            2
          )
        )
        break
      case 'result':
        res.end(
          views.debug({
            version,
            mode,
            type: page.page.contentType.split('/')[1],
            html: result
          })
        )
        break
      case 'data':
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(view.data, null, 2)
          })
        )
        break
      default:
        res.end(
          views.debug({
            version,
            mode: 'main',
            data: CircularJSON.stringify(view.data, null, 2),
            template: view.template.data,
            type: page.page.contentType.split('/')[1],
            html: result
          })
        )
        break
    }
  }
}
