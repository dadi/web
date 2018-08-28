const path = require('path')
const fs = require('fs')
const http = require('http')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const help = require(path.join(__dirname, '/../help'))

module.exports = function (req, res, next, view, page) {
  return function (err, result, unprocessed) {
    if (err) return next(err)

    let mode = view.data.debugView
    delete view.data.debugView

    switch (mode) {
      case 'json':
        Send.json(200, res, next)(null, view.data)
        break
      case 'stats':
        let stats = Object.assign(
          {},
          help.timer.getStats(),
          {
            'Data size': help.formatBytes(
              Buffer.byteLength(JSON.stringify(view.data), 'utf8'),
              3
            )
          },
          {
            'Result size': help.formatBytes(
              Buffer.byteLength(result, 'utf8'),
              3
            )
          }
        )

        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode,
            view: [
              {
                title: 'Statistics',
                id: 'data',
                json: stats
              }
            ]
          })
        )
        break
      case 'headers':
        let headers = {}

        headers.request = req.headers

        let options = {
          host: view.data.url.hostname,
          port: view.data.url.port,
          path: view.data.url.pathname,
          method: 'GET'
        }

        let newReq = http.request(options, newRes => {
          headers.response = newRes.headers

          res.setHeader('Content-Type', 'text/html')
          res.end(
            views.debug({
              mode,
              view: [
                {
                  title: 'Headers',
                  id: 'data',
                  json: headers,
                  expand: true
                }
              ]
            })
          )
        })

        newReq.end()

        break
      case 'page':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode,
            view: [
              {
                title: 'Page',
                id: 'data',
                json: page.page
              }
            ]
          })
        )
        break
      case 'ds':
        let dss = {}
        for (const key in page.datasources) {
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
            mode,
            view: [
              {
                title: 'Datasources',
                id: 'data',
                json: dss
              }
            ]
          })
        )
        break
      case 'result':
        let results = []
        results[0] = {
          title: 'No postProcessors',
          id: 'unprocessed',
          output: unprocessed,
          type: page.page.contentType.split('/')[1]
        }

        if (result !== unprocessed) {
          results[1] = {
            title: 'postProcessors applied',
            id: 'processed',
            output: result,
            type: page.page.contentType.split('/')[1]
          }
        }

        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode,
            view: results
          })
        )
        break
      case 'data':
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode,
            view: [
              {
                title: 'Page',
                id: 'data',
                json: view.data
              }
            ]
          })
        )
        break
      case 'route':
        let router = fs.readFileSync(require.resolve('path-to-regexp'), 'utf8')

        let re = new RegExp(/module\.exports(.*)?/, 'g')
        router = router.replace(re, '')

        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode,
            view: [
              {
                title: 'Page routes',
                raw: `
                <input type="text" id="inputPath" placeholder="/path/value/" value="${
  view.data.url.pathname
}"><br>
                ${page.page.routes
    .map(
      (i, idx) =>
        `<input type="text" class="inputRoute" readonly id="ir_${idx}" placeholder="/path/:key/" value="${
          i.path
        }"><br>`
    )
    .join('')}

                  <script>
                    ${router}

                    var _ = document.querySelectorAll.bind(document)

                    var inputRoutes = _('.inputRoute');

                    function update() {
                      var path = _('#inputPath')[0].value

                      for (var ir = 0; ir < inputRoutes.length; ++ir) {
                        var input = inputRoutes[ir];

                        var keys = []
                        var regexp

                        if (input.value) {
                          try {
                            regexp = pathToRegexp(input.value, keys)
                          } catch (e) {
                            console.log(e.message)
                            return
                          }
                        }

                        inputRoutes[ir].classList.remove('match');

                        if (regexp && regexp.test(path)) {
                          input.classList.add('match')
                        }
                      }
                      
                    }

                    _('#inputPath')[0].addEventListener('input', update, false)
                    update()</script>`
              }
            ]
          })
        )
        break
      default:
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            mode: 'main',
            view: [
              {
                title: 'Data',
                id: 'data',
                json: view.data
              },
              {
                title: `${page.page.template} (${
                  view.template.getEngineInfo().engine
                } ${view.template.getEngineInfo().version || ''})`,
                id: 'template',
                output: view.template.data
              },
              {
                title: 'Output',
                id: 'result',
                output: unprocessed,
                type: page.page.contentType.split('/')[1]
              }
            ]
          })
        )
        break
    }
  }
}
