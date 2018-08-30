const fs = require('fs')
const nock = require('nock')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Preload = require(path.resolve(
  path.join(__dirname, '/../../dadi/lib/datasource/preload')
))
const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const TestHelper = require(`${__dirname}/../help`)()

const config = require(path.resolve(path.join(__dirname, '/../../config')))
const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

describe('Preloader', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.stopServer(done)
  })

  it('should preload data when the server starts', done => {
    TestHelper.disableApiConfig().then(() => {
      TestHelper.updateConfig({ data: { preload: ['car_makes'] } }).then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].settings.cache = false
        pages[0].datasources = ['car_makes']

        // provide API response
        const results = {
          results: [{ make: 'ford' }, { make: 'mazda' }, { make: 'toyota' }]
        }
        const providerStub = sinon.stub(apiProvider.prototype, 'load')
        providerStub.onFirstCall().yields(null, results)

        const preloadSpy = sinon.spy(Preload.Preload.prototype, 'init')

        TestHelper.startServer(pages).then(() => {
          apiProvider.prototype.load.restore()
          preloadSpy.restore()

          preloadSpy.called.should.eql(true)
          providerStub.called.should.eql(true)

          Preload()
            .get('car_makes')
            .should.eql(results.results)

          done()
        })
      })
    })
  })
})
