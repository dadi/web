var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])

var nock = require("nock")
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

var Datasource = require(__dirname + "/../../dadi/lib/datasource")
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
        "session.js",
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
          .get(pages[0].routes[0].path + "?cache=false")
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
        "session.js",
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

  it("should get requestParams specified in session to populate placeholders in a datasource endpoint", function(done) {
    var sessionConfig = {
      sessions: {
        enabled: true,
        name: "dadiweb.sid",
        secret: "dadiwebsecretsquirrel",
        resave: true,
        saveUninitialized: true,
        cookie: {
          maxAge: 31556952000
        }
      }
    }

    TestHelper.updateConfig(sessionConfig).then(() => {
      var pages = TestHelper.newPage(
        "test",
        "/session",
        "session.js",
        ["car_makes"],
        ["session"]
      )

      var dsName = "car_makes"
      var options = TestHelper.getPathOptions()
      var dsSchema = TestHelper.getSchemaFromFile(
        options.datasourcePath,
        dsName
      )

      pages[0].contentType = "application/json"

      // modify the endpoint to give it a placeholder
      dsSchema.datasource.source.type = "remote"
      dsSchema.datasource.source.endpoint = "1.0/makes/{name}/{edition}"

      dsSchema.datasource.caching = {
        ttl: 300,
        directory: {
          enabled: false,
          path: "./cache/web/",
          extension: "json"
        },
        redis: {
          enabled: false,
          cluster: false,
          host: "127.0.0.1",
          port: 6379,
          password: ""
        }
      }

      delete dsSchema.datasource.auth
      delete dsSchema.datasource.chained

      // addrequestParams
      dsSchema.datasource.requestParams[0].type = "String"
      dsSchema.datasource.requestParams[0].source = "session"
      dsSchema.datasource.requestParams[0].param = "vehicles.make"
      dsSchema.datasource.requestParams[0].target = "endpoint"

      dsSchema.datasource.requestParams.push({
        type: "Number",
        source: "session",
        param: "vehicles.edition",
        field: "edition",
        target: "endpoint"
      })

      var stubby = sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)

        // we should be intercepting a request for '/1.0/makes/%7Bname%7D/%7Bedition%7D' (nothing set in session yet)
        var host =
          "http://" +
          dsSchema.datasource.source.host +
          ":" +
          dsSchema.datasource.source.port
        var scope = nock(host)
          .get("/1.0/makes/%7Bname%7D/%7Bedition%7D")
          .reply(200, {})

        // request page twice, the second time we should get data from the sessiom
        client
          .get(pages[0].routes[0].path + "?cache=false")
          .expect(200)
          .expect("content-type", pages[0].contentType)
          .end((err, res) => {
            if (err) return done(err)

            var cookies = res.headers["set-cookie"]
            var cookie = cookies.find(cookie => {
              return cookie.startsWith("dadiweb.sid=")
            })

            var data = cookie.split(";")[0]
            var value = data.split("=")[1]

            // we should be intercepting a request for '/1.0/makes/mazda/3' (as set in test/app/events/session.js)
            var host =
              "http://" +
              dsSchema.datasource.source.host +
              ":" +
              dsSchema.datasource.source.port

            var scope = nock(host)
              .get("/1.0/makes/mazda/3")
              .reply(200, { make: "mazda", edition: 3 })

            client
              .get(pages[0].routes[0].path + "?cache=false")
              .set("Cookie", "dadiweb.sid=" + value)
              .expect(200)
              .expect("content-type", pages[0].contentType)
              .end((err, res) => {
                if (err) return done(err)
                var data = JSON.parse(res.text)

                TestHelper.resetConfig().then(() => {
                  should.exist(data)
                  should.exist(data.make)
                  should.exist(data.edition)
                  data.make.should.eql("mazda")
                  data.edition.should.eql(3)
                  ;(data.session_id !== null).should.eql(true)

                  stubby.restore()

                  done()
                })
              })
          })
      })
    })
  })

  it("should not set a session cookie if sessions are disabled", function(done) {
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
        "session.js",
        [],
        ["session"]
      )
      pages[0].contentType = "application/json"

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)
        var sessionName = config.get("sessions.name")

        client.get(pages[0].routes[0].path).end(function(err, res) {
          if (err) return done(err)

          var cookieHeader = res.headers["set-cookie"]
          if (cookieHeader) {
            cookieHeader.indexOf(sessionName).should.equal(-1)
          }

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
        ;(
          Server.getSessionStore(config.get("sessions"), "test") === null
        ).should.eql(true)
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

    it("should throw error if an in-memory session store is used in production", function(done) {
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
