const fs = require('fs')
const nock = require('nock')
const path = require('path')
const sinon = require('sinon')
const should = require('should')
const Readable = require('stream').Readable
const request = require('supertest')
const zlib = require('zlib')

const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()
const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const page = require(`${__dirname}/../../dadi/lib/page`)

const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const remoteProvider = require(`${__dirname}/../../dadi/lib/providers/remote`)
const restProvider = require(`${__dirname}/../../dadi/lib/providers/restapi`)
const markdownProvider = require(`${__dirname}/../../dadi/lib/providers/markdown`)

const config = require(path.resolve(path.join(__dirname, '/../../config')))
let controller

describe('Data Providers', done => {
  beforeEach(done => {
    TestHelper.clearCache()

    const apiHost = `http://${config.get('api').host}:${config.get('api').port}`

    scope = nock(apiHost)
      .post('/token')
      .times(5)
      .reply(200, { accessToken: 'xx' })

    const scope1 = nock(apiHost)
      .get('/')
      .reply(200)

    const configUpdate = {
      server: {
        host: '127.0.0.1',
        port: 5000
      }
    }

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    nock.cleanAll()
    TestHelper.stopServer(() => {})
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  describe('Multi-lang', done => {
    it('should pass the lang variable to the dadiapi endpoint', done => {
      const clientHost = `http://${config.get('server.host')}:${config.get(
        'server.port'
      )}`
      const apiHost = `http://${config.get('api').host}:${
        config.get('api').port
      }`

      const client = request(clientHost)
      const endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}&lang=en'
      const scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      const page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories']
      page1.template = 'test.js'
      page1.routes[0].path = '/:lang/categories/:category'
      page1.events = []

      const pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/en/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should not pass the lang variable to the dadiapi endpoint when it is not defined in the page routes', done => {
      const clientHost = `http://${config.get('server.host')}:${config.get(
        'server.port'
      )}`
      const apiHost = `http://${config.get('api').host}:${
        config.get('api').port
      }`

      const client = request(clientHost)
      const endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}'
      const scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      const page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories']
      page1.template = 'test.js'
      page1.routes[0].path = '/categories/:category'
      page1.events = []

      const pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should not pass the lang variable to the dadiapi endpoint when i18n is false in the DS schema', done => {
      const clientHost = `http://${config.get('server.host')}:${config.get(
        'server.port'
      )}`
      const apiHost = `http://${config.get('api').host}:${
        config.get('api').port
      }`

      const client = request(clientHost)
      const endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}'
      const scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      const page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories_i18n_false']
      page1.template = 'test.js'
      page1.routes[0].path = '/:lang/categories/:category'
      page1.events = []

      const pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/en/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })
})
