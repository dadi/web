var _ = require("underscore")
var fs = require("fs")
var nock = require("nock")
var path = require("path")
var request = require("supertest")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var datasource = require(__dirname + "/../../dadi/lib/datasource")
var Page = require(__dirname + "/../../dadi/lib/page")
var Preload = require(path.resolve(
  path.join(__dirname, "/../../dadi/lib/datasource/preload")
))
var apiProvider = require(__dirname + "/../../dadi/lib/providers/dadiapi")
var TestHelper = require(__dirname + "/../help")()

var config = require(path.resolve(path.join(__dirname, "/../../config")))
var connectionString =
  "http://" + config.get("server.host") + ":" + config.get("server.port")

describe("Preloader", function(done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function(done) {
    TestHelper.stopServer(done)
  })

  it("should preload data when the server starts", function(done) {
    TestHelper.disableApiConfig().then(() => {
      TestHelper.updateConfig({ data: { preload: ["car-makes"] } }).then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].settings.cache = false
        pages[0].datasources = ["car-makes"]

        // provide API response
        var results = {
          results: [{ make: "ford" }, { make: "mazda" }, { make: "toyota" }]
        }
        var providerStub = sinon.stub(apiProvider.prototype, "load")
        providerStub.onFirstCall().yields(null, results)

        var preloadSpy = sinon.spy(Preload.Preload.prototype, "init")

        TestHelper.startServer(pages).then(() => {
          apiProvider.prototype.load.restore()
          preloadSpy.restore()

          preloadSpy.called.should.eql(true)
          providerStub.called.should.eql(true)

          Preload().get("car-makes").should.eql(results.results)

          done()
        })
      })
    })
  })
})
