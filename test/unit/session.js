var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])

var _ = require("underscore")
var fs = require("fs")
var path = require("path")
var request = require("supertest")
var should = require("should")
var session = require("express-session")
var sinon = require("sinon")

var mongoStore
if (nodeVersion < 1) {
  mongoStore = require("connect-mongo/es5")(session)
} else {
  mongoStore = require("connect-mongo")(session)
}

var api = require(__dirname + "/../../dadi/lib/api")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var Page = require(__dirname + "/../../dadi/lib/page")
var Preload = require(__dirname + "/../../dadi/lib/datasource/preload")
var Server = require(__dirname + "/../help").Server
var TestHelper = require(__dirname + "/../help")()
var remoteProvider = require(__dirname + "/../../dadi/lib/providers/remote")

var config = require(path.resolve(path.join(__dirname, "/../../config")))
var connectionString =
  "http://" + config.get("server.host") + ":" + config.get("server.port")

describe("Session", function(done) {
  before(function(done) {
    Preload().reset()
    done()
  })

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

  it("should set a session cookie", function(done) {
    var sessionConfig = {
      sessions: {
        enabled: true,
        name: "dadiweb.sid"
      },
      rewrites: {
        forceTrailingSlash: false,
        datasource: ""
      }
    }

    TestHelper.updateConfig(sessionConfig).then(() => {
      var pages = TestHelper.newPage(
        "test",
        "/session",
        "session.dust",
        [],
        ["session"]
      )
      pages[0].contentType = "application/json"

      // provide API response
      var results = { results: [{ make: "ford" }] }
      var providerStub = sinon.stub(remoteProvider.prototype, "load")
      providerStub.yields(null, results)

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)
        client
          .get(pages[0].routes[0].path)
          .expect("content-type", pages[0].contentType)
          .expect(TestHelper.shouldSetCookie("dadiweb.sid"))
          .end(function(err, res) {
            if (err) return done(err)

            providerStub.restore()
            done()
          })
      })
    })
  })

  it("should have a session object attached to the request", function(done) {
    var sessionConfig = {
      sessions: {
        enabled: true,
        name: "dadiweb.sid"
      }
    }

    TestHelper.updateConfig(sessionConfig).then(() => {
      var pages = TestHelper.newPage(
        "test",
        "/session",
        "session.dust",
        [],
        ["session"]
      )
      pages[0].contentType = "application/json"

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path)
          .expect(200)
          .expect("content-type", pages[0].contentType)
          .end(function(err, res) {
            if (err) return done(err)
            var data = JSON.parse(JSON.stringify(res.body))
            ;(data.session_id !== null).should.eql(true)

            done()
          })
      })
    })
  })

  it("should not set a session cookie if sessions are disabled", function(
    done
  ) {
    var sessionConfig = {
      sessions: {
        enabled: false,
        name: "dadiweb.sid"
      }
    }

    TestHelper.updateConfig(sessionConfig).then(() => {
      var pages = TestHelper.newPage(
        "test",
        "/session",
        "session.dust",
        [],
        ["session"]
      )
      pages[0].contentType = "application/json"

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path)
          .expect(TestHelper.shouldNotHaveHeader("Set-Cookie"))
          .end(function(err, res) {
            if (err) return done(err)
            done()
          })
      })
    })
  })

  describe("Store", function(done) {
    it("should use an in-memory store if none is specified", function(done) {
      var sessionConfig = {
        sessions: {
          enabled: true,
          name: "dadiweb.sid",
          store: ""
        }
      }

      TestHelper.updateConfig(sessionConfig).then(() => {
        ;(Server.getSessionStore(config.get("sessions"), "test") ===
          null).should.eql(true)
        done()
      })
    })

    it("should use a MongoDB store if one is specified", function(done) {
      var sessionConfig = {
        sessions: {
          enabled: true,
          name: "dadiweb.sid",
          store: "mongodb://localhost:27017/test"
        }
      }

      TestHelper.updateConfig(sessionConfig).then(() => {
        var store = Server.getSessionStore(config.get("sessions"))
        ;(typeof store).should.eql("object")
        store.options.url.should.eql("mongodb://localhost:27017/test")
        done()
      })
    })

    it("should use a Redis store if one is specified", function(done) {
      var sessionConfig = {
        sessions: {
          enabled: true,
          name: "dadiweb.sid",
          store: "redis://localhost:6379"
        }
      }

      TestHelper.updateConfig(sessionConfig).then(() => {
        var store = Server.getSessionStore(config.get("sessions"))
        ;(typeof store).should.eql("object")
        store.client.address.should.eql("localhost:6379")
        done()
      })
    })

    it("should throw error if an in-memory session store is used in production", function(
      done
    ) {
      var sessionConfig = {
        sessions: {
          enabled: true,
          name: "dadiweb.sid",
          store: ""
        }
      }

      TestHelper.updateConfig(sessionConfig).then(() => {
        should.throws(function() {
          Server.getSessionStore(config.get("sessions"), "production")
        }, Error)
        done()
      })
    })
  })
})
