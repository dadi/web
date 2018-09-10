const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const request = require('supertest')
const cheerio = require('cheerio')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()

const config = require(path.resolve(path.join(__dirname, '/../../config')))

const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

describe('Debug view', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(() => {
        setTimeout(() => {
          done()
        }, 200)
      })
    })
  })

  it('should enable the debug view if specified in the config', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=json`).end((err, res) => {
          res.body.should.not.eql({})
          res.body.page.name.should.eql('page1')
          done()
        })
      })
    })
  })

  it('should disable the debug view if specified in the config', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: false
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=json`).end((err, res) => {
          res.body.should.eql({})
          done()
        })
      })
    })
  })

  it('should return page data, template and output by default', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug`).end((err, res) => {
          const $ = cheerio.load(res.text)

          $('#data').length.should.be.above(0)
          $('#template').length.should.be.above(0)
          $('#result').length.should.be.above(0)

          done()
        })
      })
    })
  })

  it('should return rendered page output if ?debug=result', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .get(`${pages[0].routes[0].path}?debug=result`)
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#unprocessed').length.should.be.above(0)

            done()
          })
      })
    })
  })

  it('should return page data if ?debug=data', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=data`).end((err, res) => {
          const $ = cheerio.load(res.text)

          $('#template').length.should.eql(0)

          $('.view > script')
            .html()
            .toString()
            .trim()
            .should.startWith(
              "var data = new JSONEditor(document.getElementById('data'), {mode: 'view'}, {\n  \"query\": {}"
            )

          done()
        })
      })
    })
  })

  it('should return page info if ?debug=page', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=page`).end((err, res) => {
          const $ = cheerio.load(res.text)

          $('#template').length.should.eql(0)

          $('.view > script')
            .html()
            .toString()
            .trim()
            .should.startWith(
              'var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {\n  "name": "page1"'
            )

          done()
        })
      })
    })
  })

  it('should return route info if ?debug=route', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=route`).end((err, res) => {
          const $ = cheerio.load(res.text)

          $('#template').length.should.eql(0)

          $('.view')
            .html()
            .toString()
            .trim()
            .should.startWith(
              '<input type="text" id="inputPath" placeholder="/path/value/" value="/test">'
            )

          done()
        })
      })
    })
  })

  it('should return headers if ?debug=headers', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .get(`${pages[0].routes[0].path}?debug=headers`)
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view > script')
              .html()
              .toString()
              .trim()
              .should.startWith(
                "var data = new JSONEditor(document.getElementById('data'), {mode: 'view'}, {\n  \"request\""
              )

            done()
          })
      })
    })
  })

  it('should return stats if ?debug=stats', done => {
    // create page 1
    const pages = TestHelper.setUpPages()
    pages[0].routes[0].path = '/statstest'
    pages[0].datasources = ['markdown']

    const dsSchema = TestHelper.getSchemaFromFile(
      TestHelper.getPathOptions().datasourcePath,
      'markdown'
    )

    sinon
      .stub(Datasource.Datasource.prototype, 'loadDatasource')
      .yields(null, dsSchema)

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=stats`).end((err, res) => {
          if (err) done(err)
          const $ = cheerio.load(res.text)

          $('#template').length.should.eql(0)

          $('.view > script')
            .html()
            .toString()
            .trim()
            .should.startWith(
              "var data = new JSONEditor(document.getElementById('data'), {mode: 'view'}, {\n  \"get\""
            )

          done()
        })
      })
    })
  })

  it('should return stats if ?debug=ds', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get(`${pages[0].routes[0].path}?debug=ds`).end((err, res) => {
          const $ = cheerio.load(res.text)

          $('#template').length.should.eql(0)

          $('.view > script')
            .html()
            .toString()
            .trim()
            .should.startWith(
              "var data = new JSONEditor(document.getElementById('data'), {mode: 'view'}, {}"
            )

          done()
        })
      })
    })
  })

  it('should return both rendered page outputs if ?debug=result and a post-processor used', done => {
    const pages = TestHelper.setUpPages()
    pages[0].template = 'test.js'
    pages[0].postProcessors = ['replace-sir']

    // provide API response
    const results = {
      debugView: 'result',
      names: [
        { title: 'Sir', name: 'Moe' },
        { title: 'Sir', name: 'Larry' },
        { title: 'Sir', name: 'Curly' }
      ]
    }
    const fake = sinon
      .stub(Controller.Controller.prototype, 'loadData')
      .yields(null, results)

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .get(`${pages[0].routes[0].path}?debug=result`)
          .end((err, res) => {
            // console.log(res.text)
            const $ = cheerio.load(res.text)

            $('#unprocessed').length.should.be.above(0)
            $('#processed').length.should.be.above(0)

            fake.reset()

            done()
          })
      })
    })
  })
})
