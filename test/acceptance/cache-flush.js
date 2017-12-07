var fs = require("fs")
var nock = require("nock")
var path = require("path")
var request = require("supertest")
var should = require("should")
var sinon = require("sinon")
var url = require("url")

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

var clientHost =
  "http://" + config.get("server.host") + ":" + config.get("server.port")
var apiHost = "http://" + config.get("api.host") + ":" + config.get("api.port")
var credentials = {
  clientId: config.get("auth.clientId"),
  secret: config.get("auth.secret")
}

var token = JSON.stringify({
  accessToken: "da6f610b-6f91-4bce-945d-9829cac5de71",
  tokenType: "Bearer",
  expiresIn: 1800
})

var fordResult = JSON.stringify({
  results: [
    {
      makeName: "Ford"
    }
  ]
})

var toyotaResult = JSON.stringify({
  results: [
    {
      makeName: "Toyota"
    }
  ]
})

var categoriesResult1 = JSON.stringify({
  results: [
    {
      name: "Crime"
    }
  ]
})

var categoriesResult2 = JSON.stringify({
  results: [
    {
      name: "Horror"
    }
  ]
})

var carscope
var catscope

describe("Cache Flush", function(done) {
  this.timeout(4000)

  var auth
  var body = "<html><body>Test</body></html>"

  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({}).then(() => {
          TestHelper.setupApiIntercepts()
          TestHelper.clearCache()

          // fake token post
          // var scope = nock('http://127.0.0.1:3000')
          //   .post('/token')
          //   .times(5)
          //   .reply(200, {
          //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
          //   })

          // fake api data request
          var dsEndpoint =
            'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
          var dsPath = url.parse(dsEndpoint).path
          carscope = nock("http://127.0.0.1:3000")
            .get(dsPath)
            .times(2)
            .reply(200, fordResult)

          dsEndpoint =
            'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
          dsPath = url.parse(dsEndpoint).path
          catscope = nock("http://127.0.0.1:3000")
            .get(dsPath)
            .times(2)
            .reply(200, categoriesResult1)

          // create a page
          var name = "test"
          var schema = TestHelper.getPageSchema()
          var page = Page(name, schema)
          var dsName = "car_makes_unchained"
          var options = TestHelper.getPathOptions()

          page.datasources = ["car_makes_unchained"]
          page.template = "test_cache_flush.js"

          // add two routes to the page for testing specific path cache clearing
          page.routes[0].path = "/test"
          page.routes.push({ path: "/extra_test" })

          page.events = []

          // create a second page
          var page2 = Page("page2", TestHelper.getPageSchema())
          page2.datasources = ["categories"]
          page2.template = "test.js"

          // add two routes to the page for testing specific path cache clearing
          page2.routes[0].path = "/page2"
          page2.events = []
          // delete page2.route.constraint

          var pages = []
          pages.push(page)
          pages.push(page2)

          TestHelper.startServer(pages).then(() => {
            var client = request(clientHost)

            client
              .get("/test")
              // .expect('content-type', 'text/html')
              // .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers["x-cache"].should.exist
                res.headers["x-cache"].should.eql("MISS")

                client
                  .get("/extra_test")
                  // .expect('content-type', 'text/html')
                  // .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)
                    res.headers["x-cache"].should.exist
                    res.headers["x-cache"].should.eql("MISS")

                    client
                      .get("/page2")
                      // .expect('content-type', 'text/html')
                      // .expect(200)
                      .end(function(err, res) {
                        if (err) return done(err)

                        res.headers["x-cache"].should.exist
                        res.headers["x-cache"].should.eql("MISS")
                        done()
                      })
                  })
              })
          })
        })
      })
    })
  })

  afterEach(function(done) {
    TestHelper.resetConfig().then(() => {
      nock.cleanAll()
      TestHelper.clearCache()
      TestHelper.stopServer(done)
    })
  })

  it("should return 401 if clientId and secret are not passed", function(done) {
    // config.set('api.enabled', true)

    // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(1)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // attempt to clear cache
    var client = request(clientHost)
    client
      .post("/api/flush")
      .set("content-type", "application/json")
      .send({ path: "/test" })
      .expect(401)
      .end(function(err, res) {
        if (err) return done(err)
        done()
      })
  })

  it("should return 401 if clientId and secret are invalid", function(done) {
    // config.set('api.enabled', true)
    //
    // // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(1)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // attempt to clear cache
    var client = request(clientHost)
    client
      .post("/api/flush")
      .set("content-type", "application/json")
      .send({ path: "/test", clientId: "x", secret: "y" })
      .expect(401)
      .end(function(err, res) {
        if (err) return done(err)
        done()
      })
  })

  it("should flush only cached items matching the specified path", function(done) {
    // config.set('api.enabled', true)
    //
    // // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(3)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // get cached version of the page
    var client = request(clientHost)
    client
      .get("/test")
      .expect("content-type", "text/html")
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.headers["x-cache"].should.exist
        res.headers["x-cache"].should.eql("HIT")

        // clear cache for this path
        client
          .post("/api/flush")
          .send(Object.assign({}, { path: "/test" }, credentials))
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)
            res.body.result.should.equal("success")

            // get page again, should be uncached
            var client = request(clientHost)
            client
              .get("/test")
              .expect("content-type", "text/html")
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers["x-cache"].should.exist
                res.headers["x-cache"].should.eql("MISS")

                // get second route again, should still be cached
                var client = request(clientHost)
                client
                  .get("/extra_test")
                  .expect("content-type", "text/html")
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)

                    res.headers["x-cache"].should.exist
                    res.headers["x-cache"].should.eql("HIT")
                    done()
                  })
              })
          })
      })
  })

  it("should flush all cached items when no path is specified", function(done) {
    // config.set('api.enabled', true)
    //
    // // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(4)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // get cached version of the page
    var client = request(clientHost)
    client
      .get("/test")
      .expect("content-type", "text/html")
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.headers["x-cache"].should.exist
        res.headers["x-cache"].should.eql("HIT")

        // clear cache for this path
        client
          .post("/api/flush")
          .send(Object.assign({}, { path: "*" }, credentials))
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)
            res.body.result.should.equal("success")

            // get page again, should be uncached
            var client = request(clientHost)
            client
              .get("/test")
              .expect("content-type", "text/html")
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)

                res.headers["x-cache"].should.exist
                res.headers["x-cache"].should.eql("MISS")

                // get second route again, should still be cached
                var client = request(clientHost)
                client
                  .get("/extra_test")
                  .expect("content-type", "text/html")
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)

                    res.headers["x-cache"].should.exist
                    res.headers["x-cache"].should.eql("MISS")

                    done()
                  })
              })
          })
      })
  })

  it("should flush associated datasource files when flushing by path", function(done) {
    nock.cleanAll()

    // fake token post
    var scope = nock("http://127.0.0.1:3000")
      .post("/token")
      .times(6)
      .reply(200, {
        accessToken: "da6f610b-6f91-4bce-945d-9829cac5de71"
      })

    // fake api data requests
    var dsEndpoint =
      'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
    var dsPath = url.parse(dsEndpoint).path
    carscope = nock("http://127.0.0.1:3000")
      .get(dsPath)
      .times(1)
      .reply(200, toyotaResult)

    dsEndpoint =
      'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
    dsPath = url.parse(dsEndpoint).path
    catscope = nock("http://127.0.0.1:3000")
      .get(dsPath)
      .times(1)
      .reply(200, categoriesResult2)

    // get cached version of the page
    var client = request(clientHost)
    client
      .get("/test")
      .expect("content-type", "text/html")
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.headers["x-cache"].should.exist
        res.headers["x-cache"].should.eql("HIT")

        res.text.should.eql("<ul><li>Ford</li></ul>")

        // get cached version of page2
        client
          .get("/page2")
          .expect("content-type", "text/html")
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            res.headers["x-cache"].should.exist
            res.headers["x-cache"].should.eql("HIT")
            res.text.should.eql("<h3>Crime</h3>")

            // clear cache for page1
            client
              .post("/api/flush")
              .send(Object.assign({}, { path: "/test" }, credentials))
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.body.result.should.equal("success")

                // get first page again, should be uncached and with different data
                client
                  .get("/test")
                  .expect("content-type", "text/html")
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)
                    res.headers["x-cache"].should.exist
                    res.headers["x-cache"].should.eql("MISS")
                    res.text.should.eql("<ul><li>Toyota</li></ul>")

                    setTimeout(function() {
                      // remove html files so the ds files have to be used to generate
                      // new ones
                      var files = fs.readdirSync(
                        config.get("caching.directory.path")
                      )
                      files
                        .filter(function(file) {
                          return file.substr(-10) === ".html.gzip"
                        })
                        .forEach(function(file) {
                          fs.unlinkSync(
                            path.join(
                              config.get("caching.directory.path"),
                              file
                            )
                          )
                        })

                      // get second page again, should return same data
                      client
                        .get("/page2")
                        .expect("content-type", "text/html")
                        .expect(200)
                        .end(function(err, res) {
                          if (err) return done(err)

                          res.headers["x-cache"].should.exist
                          res.headers["x-cache"].should.eql("MISS")

                          res.text.should.eql("<h3>Crime</h3>")

                          done()
                        })
                    }, 500)
                  })
              })
          })
      })
  })

  it("should flush datasource files when flushing all", function(done) {
    // fake api data requests
    nock.cleanAll()

    // fake token post
    var scope = nock("http://127.0.0.1:3000")
      .post("/token")
      .times(4)
      .reply(200, {
        accessToken: "da6f610b-6f91-4bce-945d-9829cac5de71"
      })

    var dsEndpoint =
      'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
    var dsPath = url.parse(dsEndpoint).path
    carscope = nock("http://127.0.0.1:3000")
      .get(dsPath)
      .times(1)
      .reply(200, toyotaResult)

    // get cached version of the page
    var client = request(clientHost)
    client
      .get("/test")
      .expect("content-type", "text/html")
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.headers["x-cache"].should.exist
        res.headers["x-cache"].should.eql("HIT")

        res.text.should.eql("<ul><li>Ford</li></ul>")

        // clear cache for this path
        client
          .post("/api/flush")
          .send(Object.assign({}, { path: "*" }, credentials))
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)
            res.body.result.should.equal("success")

            // get page again, should be uncached and with different data
            setTimeout(function() {
              var client = request(clientHost)
              client
                .get("/test")
                .expect("content-type", "text/html")
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  res.headers["x-cache"].should.exist
                  res.headers["x-cache"].should.eql("MISS")

                  res.text.should.eql("<ul><li>Toyota</li></ul>")

                  done()
                })
            }, 500)
          })
      })
  })
})
