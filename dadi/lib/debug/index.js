const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const help = require(path.join(__dirname, '/../help'))

const CircularJSON = require('circular-json')

module.exports = function (req, res, next, view, page) {
  return function (err, result, unprocessed) {
    if (err) return next(err)

    const version = help.getVersion()

    const mode = view.data.debugView
    delete view.data.debugView

    switch (mode) {
      case 'json':
        Send.json(200, res, next)(null, view.data)
        break
      case 'stats':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(help.timer.getStats(), null, 2)
          })
        )
        break
      case 'page':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(page.page, null, 2)
          })
        )
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

        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(dss, null, 2)
          })
        )
        break
      case 'result':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            type: page.page.contentType.split('/')[1],
            output: unprocessed,
            pane3:
              result === unprocessed
                ? 'No post-process events used'
                : 'Before post-process events',
            output2: result === unprocessed ? null : result
          })
        )
        break
      case 'data':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(view.data, null, 2)
          })
        )
        break
      default:
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode: 'main',
            data: CircularJSON.stringify(view.data, null, 2),
            template: view.template.data,
            type: page.page.contentType.split('/')[1],
            output: unprocessed,
            pane1: 'JSON',
            pane2: `${page.page.template} (${
              view.template.getEngineInfo().engine
            } ${view.template.getEngineInfo().version})`,
            pane3: 'Output'
          })
        )
        break
    }
  }
}
