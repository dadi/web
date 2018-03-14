const url = require('url')
const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const CircularJSON = require('circular-json')

module.exports = function (req, res, next, template, data, context) {
  // Traditional JSON view
  if (data.debugView === 'json') return Send.json(200, res, next)

  return function (err, result) {
    if (err) return next(err)

    switch (data.debugView) {
      case 'template':
        delete template.engine

        Send.json(200, res, next)(null, template)
        break
      case 'page':
        Send.json(200, res, next)(null, context.page)
        break
      case 'headers':
        Send.json(200, res, next)(null, req.headers)
        break
      case 'datasources':
        // Remove page info
        Object.keys(context.datasources).forEach(key => {
          delete context.datasources[key].page
          delete context.datasources[key].options
        })

        res.setHeader('Content-Type', 'application/json')
        res.end(CircularJSON.stringify(context.datasources, null, 2))
        break
      case 'url':
        res.setHeader('Content-Type', 'application/json')
        res.end(
          CircularJSON.stringify(
            {
              url: url.parse(`${req.protocol}://${req.headers.host}${req.url}`),
              params: data.params,
              query: data.query
            },
            null,
            2
          )
        )
        break
      case 'raw':
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(result.raw)
        break
      case 'output':
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(result.processed)
        break
      default:
        res.end(
          views.debug({
            data: CircularJSON.stringify(data, null, 2),
            template: template.data,
            html: result.raw
          })
        )
        break
    }
  }
}
