const path = require('path')
const fs = require('fs')
const Send = require(path.join(__dirname, '/../view/send'))
const views = require('./views')
const help = require(path.join(__dirname, '/../help'))

const pathToRegexp = require.resolve('path-to-regexp')

const CircularJSON = require('circular-json')

function formatBytes (a, b) {
  if (a === 0) return '0 Bytes'
  var c = 1024
  var d = b || 2
  var e = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  var f = Math.floor(Math.log(a) / Math.log(c))
  return parseFloat((a / Math.pow(c, f)).toFixed(d)) + ' ' + e[f]
}

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
        const stats = Object.assign(
          {},
          help.timer.getStats(),
          { 'Data size': formatBytes(Buffer.byteLength(view.data, 'utf8'), 3) },
          { 'Result size': formatBytes(Buffer.byteLength(result, 'utf8'), 3) }
        )
        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            data: CircularJSON.stringify(stats, null, 2)
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
      case 'route':
        let router = fs.readFileSync(pathToRegexp, 'utf8')

        var re = new RegExp(/module\.exports(.*)?/, 'g')
        router = router.replace(re, '')

        res.setHeader('Content-Type', 'text/html')
        res.end(
          views.debug({
            version,
            mode,
            view: `

<input type="text" id="inputPath" placeholder="/path/value/" value="${
              view.data.url.pathname
            }"><br>

${page.page.routes
              .map(
                (i, idx) => `
<input type="text" class="inputRoute" readonly id="ir_${idx}" placeholder="/path/:key/" value="${
                  i.path
                }"><br>
`
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
update()

          </script>`
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
