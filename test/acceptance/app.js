var _ = require("underscore")
var nock = require("nock")
var path = require("path")
var request = require("supertest")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var cache = require(__dirname + "/../../dadi/lib/cache")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var datasource = require(__dirname + "/../../dadi/lib/datasource")
var page = require(__dirname + "/../../dadi/lib/page")
var TestHelper = require(__dirname + "/../help")()
var Server = require(__dirname + "/../../dadi/lib")
var config = require(path.resolve(path.join(__dirname, "/../../config")))

var secureClientHost =
  "https://" + config.get("server.host") + ":" + config.get("server.port")
var secureClient = request(secureClientHost)
var scope

describe("Application", function() {
  beforeEach(function(done) {
    TestHelper.clearCache()

    var apiHost =
      "http://" + config.get("api.host") + ":" + config.get("api.port")
    scope = nock(apiHost)
      .post("/token")
      .times(5)
      .reply(200, { accessToken: "xx" })

    var scope1 = nock(apiHost).get("/").reply(200)

    var configUpdate = {
      server: {
        host: "127.0.0.1",
        port: 5000
      }
    }

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  //   TestHelper.resetConfig().then(() => {
  //     var apiHost = "http://" + config.get("api.host") + ":" + config.get("api.port")
  //     scope = nock(apiHost)
  //       .post("/token")
  //       .times(5)
  //       .reply(200, { accessToken: "xx" })
  //     var scope1 = nock(apiHost).get("/").times(5).reply(200)
  //     done()
  //   })
  // })

  afterEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  after(function(done) {
    delete require.cache[path.resolve(path.join(__dirname, "/../../config"))]

    TestHelper.updateConfig({
      server: {
        host: "127.0.0.1",
        port: 5111,
        redirectPort: 0,
        protocol: "http"
      }
    }).then(() => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.stopServer(done)
      })
    })
  })

  describe("Cache", function() {
    it("should return MISS when not found in cache", function(done) {
      var clientHost =
        "http://" + config.get("server.host") + ":" + config.get("server.port")
      var apiHost =
        "http://" + config.get("api.host") + ":" + config.get("api.port")
      var client = request(clientHost)

      var endpoint1 =
        "/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D"
      var scope2 = nock(apiHost)
        .get(endpoint1)
        .reply(200, JSON.stringify({ results: [{ name: "Crime" }] }))

      // create page 1
      var page1 = page("page1", TestHelper.getPageSchema())
      page1.datasources = ["categories"]
      page1.template = "test.dust"
      page1.routes[0].path = "/categories/:category"
      page1.events = []

      var pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/categories/Crime").end((err, res) => {
            if (err) return done(err)

            res.text.should.eql("<h3>Crime</h3>")
            should.exist(res.headers["x-cache"])
            res.headers["x-cache"].should.eql("MISS")

            done()
          })
        })
      })
    })
  })

  describe("Status Endpoint", function() {
    describe("GET", function() {
      it("should return 405 error", function(done) {
        var clientHost =
          "http://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")
        var apiHost =
          "http://" + config.get("api.host") + ":" + config.get("api.port")
        var client = request(clientHost)

        var pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client.get("/api/status").expect(405).end(done)
          })
        })
      })
    })

    describe("POST", function() {
      it("should return 401 error if clientId or secret aren't specified", function(
        done
      ) {
        var clientHost =
          "http://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")
        var apiHost =
          "http://" + config.get("api.host") + ":" + config.get("api.port")
        var client = request(clientHost)

        var pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client.post("/api/status").send({}).expect(401).end(done)
          })
        })
      })

      it("should return 401 error if clientId or secret don't match config", function(
        done
      ) {
        var clientHost =
          "http://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")
        var apiHost =
          "http://" + config.get("api.host") + ":" + config.get("api.port")
        var client = request(clientHost)

        var pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client
              .post("/api/status")
              .send({
                clientId: "xyz",
                secret: "123"
              })
              .expect(401)
              .end(done)
          })
        })
      })
    })
  })

  describe("Error Pages", function() {
    it("should return HTML error when no custom page exists", function(done) {
      var clientHost =
        "http://" + config.get("server.host") + ":" + config.get("server.port")
      var apiHost =
        "http://" + config.get("api.host") + ":" + config.get("api.port")
      var client = request(clientHost)

      // create page 1
      var page1 = page("page1", TestHelper.getPageSchema())
      page1.datasources = []
      page1.template = "test.dust"
      page1.routes[0].path = "/test"
      page1.events = ["test_500_error"]

      var pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/test").end((err, res) => {
            if (err) return done(err)
            res.headers["content-type"].should.eql("text/html")
            res.text
              .indexOf("<h1>Something went wrong.</h1>")
              .should.be.above(0)
            done()
          })
        })
      })
    })
  })
})
