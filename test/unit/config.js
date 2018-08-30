const fs = require('fs')
const path = require('path')
const should = require('should')
const request = require('supertest')
const sinon = require('sinon')

let api
const Server = require(`${__dirname}/../../dadi/lib`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const TestHelper = require(`${__dirname}/../help`)()

const config = require(path.resolve(path.join(__dirname, '/../../config')))

const testConfigPath = './config/config.test.json'
let domainConfigPath

function createDomainConfig () {
  TestHelper.updateConfig({
    server: {
      host: '127.0.0.1',
      port: 5111,
      protocol: 'http'
    }
  }).then(() => {
    try {
      const server = config.get('server')
      domainConfigPath = `./config/${server.host}:${server.port}.json`

      const testConfig = JSON.parse(
        fs.readFileSync(testConfigPath, { encoding: 'utf-8' })
      )
      testConfig.app.name = 'Domain Loaded Config'
      fs.writeFileSync(domainConfigPath, JSON.stringify(testConfig, null, 2))

      config.loadFile(domainConfigPath)
    } catch (err) {
      console.log(err)
    }
  })
}

function cleanup () {
  try {
    fs.unlinkSync(domainConfigPath)
  } catch (err) {
    console.log(err)
  }
}

describe('Config', done => {
  before(done => {
    delete require.cache[`${__dirname}/../../dadi/lib/api`]
    api = require(`${__dirname}/../../dadi/lib/api`)
    done()
  })

  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  it('should load a domain specific config file if available', done => {
    TestHelper.disableApiConfig().then(() => {
      createDomainConfig()

      setTimeout(() => {
        const pages = TestHelper.newPage(
          'test',
          '/session',
          'session.js',
          [],
          ['session']
        )
        pages[0].contentType = 'application/json'

        delete require.cache[
          path.resolve(path.join(__dirname, '/../../config'))
        ]

        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`

        TestHelper.startServer(pages).then(() => {
          const client = request(connectionString)
          client
            .get(pages[0].routes[0].path)
            .expect(200)
            .expect('content-type', pages[0].contentType)
            .end((err, res) => {
              if (err) return done(err)
              config.get('app.name').should.eql('Domain Loaded Config')
              cleanup()
              done()
            })
        })
      }, 1000)
    })
  })
})
