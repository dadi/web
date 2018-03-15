const url = require('url')
const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const CircularJSON = require('circular-json')

module.exports = function (req, res, next, view, page) {
  return function (err, result) {
    if (err) return next(err)

    switch (view.data.debugView) {
      case 'template':
        // delete template.engine

        Send.json(200, res, next)(null, view.template)
        break
      case 'json':
        Send.json(200, res, next)(null, view.data)
        break
      case 'page':
        Send.json(200, res, next)(null, page.page)
        break
      case 'headers':
        Send.json(200, res, next)(null, req.headers)
        break
      case 'datasources':
        // Remove page info
        Object.keys(page.datasources).forEach(key => {
          delete page.datasources[key].page
          delete page.datasources[key].options
        })

        res.setHeader('Content-Type', 'application/json')
        res.end(CircularJSON.stringify(page.datasources, null, 2))
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
      case 'html':
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(result)
        break
      default:
        res.end(
          views.debug({
            data: CircularJSON.stringify(view.data, null, 2),
            template: view.template.data,
            html: result
          })
        )
        break
    }
  }
}
