var _ = require('underscore')
var fs = require('fs')
var path = require('path')
var should = require('should')
var request = require('supertest')
var sinon = require('sinon')

var api = require(__dirname + '/../../dadi/lib/api')
var Server = require(__dirname + '/../../dadi/lib')
var Page = require(__dirname + '/../../dadi/lib/page')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var TestHelper = require(__dirname + '/../help')()

var config = require(path.resolve(path.join(__dirname, '/../../config')))

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var testConfigPath = './config/config.test.json'
var domainConfigPath

function createDomainConfig () {
  var server = config.get('server')
  domainConfigPath = './config/' + server.host + ':' + server.port + '.json'

  try {
    var testConfig = JSON.parse(fs.readFileSync(testConfigPath, { encoding: 'utf-8'}))
    testConfig.app.name = 'Domain Loaded Config'
    fs.writeFileSync(domainConfigPath, JSON.stringify(testConfig, null, 2))
  } catch (err) {
    console.log(err)
  }
}

function cleanup () {
  try {
    fs.unlinkSync(domainConfigPath)
  } catch (err) {
    console.log(err)
  }
}

describe('Config', function (done) {
  beforeEach(function (done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  afterEach(function (done) {
    TestHelper.stopServer(done)
  })

  it('should load a domain specific config file if available', function (done) {
    var apiConfig = {
      api: {
        enabled: false
      }
    }

    TestHelper.updateConfig(apiConfig).then(() => {
      createDomainConfig()

      var pages = TestHelper.newPage('test', '/session', 'session.dust', [], ['session'])
      pages[0].contentType = 'application/json'

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)
        client
        .get(pages[0].routes[0].path)
        .expect(200)
        .expect('content-type', pages[0].contentType)
        .end(function (err, res) {
          if (err) return done(err)
          config.get('app.name').should.eql('Domain Loaded Config')
          cleanup()
          done()
        })
      })
    })
  })
})
