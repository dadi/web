const url = require('url')
const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))
const CircularJSON = require('circular-json')

module.exports = function (req, res, next, data, context) {
  // Traditional JSON view
  if (data.debugView === 'json') return Send.json(200, res, next)

  return function (err, result, dsResponse) {
    if (err) return next(err)

    console.log(context)

    switch (data.debugView) {
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
        res.end('debug view')
        break
    }
  }
}
