var _ = require('underscore')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var request = require('supertest')
var should = require('should')
var sinon = require('sinon')

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var help = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var Preload = require(path.resolve(path.join(__dirname, '/../../dadi/lib/datasource/preload')))
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')
var Server
var testHelper = require(__dirname + '/../help')

var config
var testConfigString
var configKey = path.resolve(path.join(__dirname, '/../../config'))

var connectionString

var options = {
  datasourcePath: __dirname + '/../app/datasources',
  pagePath: __dirname + '/../app/pages',
  eventPath: __dirname + '/../app/events'
}

function startServer (page) {
  Server.app = api()
  Server.components = {}

  Server.start(function () {
    Server.addComponent({
      key: page.key,
      routes: page.routes,
      component: Controller(page, options)
    }, false)
  })
}

function getPage () {
  // create a page
  var name = 'test'
  var schema = testHelper.getPageSchema()
  var page = Page(name, schema)

  page.contentType = 'application/json';
  page.template = 'test.dust';
  page.routes[0].path = '/test';
  page.settings.cache = false;

  page.datasources = [];
  page.events = [];

  return page
}

describe('Preloader', function (done) {

  before(function(done) {
    delete require.cache[__dirname + '/../../dadi/lib']
    Server = require(__dirname + '/../../dadi/lib')
    done()
  })

  beforeEach(function(done) {
    // reset config
    delete require.cache[configKey]
    config = require(configKey)
    testConfigString = fs.readFileSync(config.configPath()).toString()

    config.loadFile(path.resolve(config.configPath()))

    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.api.enabled = false
    newTestConfig.data = {
      preload: [
        'car-makes'
      ]
    }

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    delete require.cache[configKey]
    config = require(configKey)
    config.loadFile(config.configPath())

    done()
  });

  afterEach(function (done) {
    Server.stop(function () {
      // reset config
      fs.writeFileSync(config.configPath(), testConfigString)
      delete require.cache[configKey]

      done()
    })
  })

  it("should preload data when the server starts", function (done) {
    // create a page
    var name = 'test'
    var schema = testHelper.getPageSchema()
    var options = testHelper.getPathOptions()
    var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes')
    var page = getPage()
    page.datasources = ['car-makes']

    sinon.stub(datasource.Datasource.prototype, 'loadDatasource').yields(null, dsSchema)

    // provide API response
    var results = { results: [{ "make": "ford" }, { "make": "mazda" }, { "make": "toyota" }] }
    var providerStub = sinon.stub(remoteProvider.prototype, 'load')
    providerStub.onFirstCall().yields(null, results)

    var preloadSpy = sinon.spy(Preload.Preload.prototype, 'init')

    startServer(page)

    datasource.Datasource.prototype.loadDatasource.restore()
    remoteProvider.prototype.load.restore()
    preloadSpy.restore()

    preloadSpy.called.should.eql(true)
    providerStub.called.should.eql(true)

    Preload().get('car-makes').should.eql(results.results)

    done()
  })
})
