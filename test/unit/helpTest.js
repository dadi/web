var _ = require("underscore")
var nock = require("nock")
var request = require("supertest")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var Server = require(__dirname + "/../../dadi/lib")
var Page = require(__dirname + "/../../dadi/lib/page")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var TestHelper = require(__dirname + "/../help")()
var config = require(__dirname + "/../../config")
var help = require(__dirname + "/../../dadi/lib/help")
var remoteProvider = require(__dirname + "/../../dadi/lib/providers/remote")
var apiProvider = require(__dirname + "/../../dadi/lib/providers/dadiapi")
var Helper = require(__dirname + "/../../dadi/lib/help")

var connectionString =
  "http://" + config.get("server.host") + ":" + config.get("server.port")

describe("Help", function(done) {
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

  describe("HtmlEncode", function() {
    it("should HTML encode the specified string", function(done) {
      Helper.htmlEncode("\u00A0").should.eql("&#160;")
      done()
    })
  })

  describe("Timer", function() {
    it("should save and return stats", function(done) {
      sinon.stub(Helper.timer, "isDebugEnabled", () => {
        return true
      })

      var key = "load"

      Helper.timer.start(key)
      Helper.timer.stop(key)

      var stats = Helper.timer.getStats()

      Helper.timer.isDebugEnabled.restore()

      stats[0].key.should.eql(key)
      should.exist(stats[0].value)
      done()
    })
  })
})
