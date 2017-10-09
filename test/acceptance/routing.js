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

var clientHost
var secureClientHost
var apiHost
var credentials
var client
var secureClient
var scope

describe("Routing", function(done) {
  before(function(done) {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    done()
  })

  after(function(done) {
    delete require.cache[path.resolve(path.join(__dirname, "/../../config"))]

    TestHelper.updateConfig({
      server: {
        host: "127.0.0.1",
        port: 5111,
        redirectPort: 0,
        protocol: "http"
      },
      rewrites: {
        forceDomain: ""
      }
    }).then(() => {
      TestHelper.stopServer(done)
    })
  })

  beforeEach(function(done) {
    //scope = nock(apiHost).post('/token').reply(200, { accessToken: 'xx' })
    var configUpdate = {
      server: {
        enabled: true,
        host: "127.0.0.1",
        port: 5000,
        redirectPort: 0,
        protocol: "http"
      }
    }

    TestHelper.setupApiIntercepts()

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        clientHost =
          "http://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")
        secureClientHost =
          "https://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")

        apiHost =
          "http://" + config.get("api.host") + ":" + config.get("api.port")
        credentials = {
          clientId: config.get("auth.clientId"),
          secret: config.get("auth.secret")
        }

        client = request(clientHost)
        secureClient = request(secureClientHost)

        done()
      })
    })
  })

  afterEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  it("should reject requests with no hostname", function(done) {
    var pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      client
        .get("/test")
        .set("Host", "")
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  describe("req.protocol", function() {
    it("should add req.protocol = http when server.protocol is http", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          host: "127.0.0.1",
          port: 5000,
          protocol: "http"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            var req = method.firstCall.args[0]
            req.protocol.should.exist
            req.protocol.should.eql("http")
            done()
          })
        })
      })
    })

    it("should add req.protocol = https when server.protocol is https", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/unprotected/key.pem",
          sslCertificatePath: "test/ssl/unprotected/cert.pem"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            var req = method.firstCall.args[0]
            req.protocol.should.exist
            req.protocol.should.eql("https")
            done()
          })
        })
      })
    })

    it("should use X-Forwarded-Proto header when trustProxy is true", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/unprotected/key.pem",
          sslCertificatePath: "test/ssl/unprotected/cert.pem"
        },
        security: {
          trustProxy: true
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get("/test")
            .set("X-Forwarded-Proto", "https")
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()
              var req = method.firstCall.args[0]
              req.protocol.should.exist
              req.protocol.should.eql("https")
              done()
            })
        })
      })
    })
  })

  describe("req.secure", function() {
    it("should add req.secure = false when server.protocol is http", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          host: "127.0.0.1",
          port: 5000,
          protocol: "http"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            var req = method.firstCall.args[0]
            req.secure.should.exist
            req.secure.should.eql(false)
            done()
          })
        })
      })
    })

    it("should add req.secure = true when server.protocol is https", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          host: "127.0.0.1",
          port: 5000,
          protocol: "https"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            var req = method.firstCall.args[0]
            req.secure.should.exist
            req.secure.should.eql(true)
            done()
          })
        })
      })
    })
  })

  describe("req.ip", function() {
    it("should add ip from socket when trustProxy is false", function(done) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: false
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ip = "54.53.78.111"
          client
            .get("/test")
            .set("X-Forwarded-For", ip)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql("127.0.0.1")
              done()
            })
        })
      })
    })

    it("should add ip from X-Forwarded-For when trustProxy is true", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: true
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ip = "54.53.78.111"
          client
            .get("/test")
            .set("X-Forwarded-For", ip)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ip)
              done()
            })
        })
      })
    })

    it("should use left-most ip from X-Forwarded-For when trustProxy is true", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: true
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ips = ["54.53.78.111", "55.50.13.100"]
          client
            .get("/test")
            .set("X-Forwarded-For", ips)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ips[0])
              done()
            })
        })
      })
    })

    it("should use first untrusted ip from X-Forwarded-For when trustProxy is an array of ips", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: ["127.0.0.1", "36.227.220.163"]
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ips = "36.227.220.63, 36.227.220.163"
          client
            .get("/test")
            .set("X-Forwarded-For", ips)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql("36.227.220.63")
              done()
            })
        })
      })
    })
  })

  describe("req.ips", function() {
    it("should add ips from socket when trustProxy is false", function(done) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: false
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ips = ["54.53.78.111", "55.50.13.100"]
          client
            .get("/test")
            .set("X-Forwarded-For", ips)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ips.should.exist
              req.ip.should.eql("127.0.0.1")
              done()
            })
        })
      })
    })

    it("should add ips from X-Forwarded-For when trustProxy is true", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: true
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var ips = ["54.53.78.111", "55.50.13.100"]
          client
            .get("/test")
            .set("X-Forwarded-For", ips)
            .end(function(err, res) {
              if (err) return done(err)

              method.restore()

              var req = method.firstCall.args[0]
              req.ips.should.exist
              req.ips.should.eql(ips)
              done()
            })
        })
      })
    })
  })

  describe("https with unprotected ssl key", function() {
    it("should return 200 ok when using unprotected ssl key without a passphrase", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/unprotected/key.pem",
          sslCertificatePath: "test/ssl/unprotected/cert.pem"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })
  })

  describe("https with protected ssl key", function() {
    it("should throw a bad password read exception when using protected ssl key without a passphrase", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/protected/key.pem",
          sslCertificatePath: "test/ssl/protected/cert.pem"
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).catch(err => {
          err.message.should.eql(
            "error starting https server: required ssl passphrase not provided"
          )
          done()
        })
      })
    })

    it("should throw a bad password read exception when using protected ssl key with the wrong passphrase", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/protected/key.pem",
          sslCertificatePath: "test/ssl/protected/cert.pem",
          sslPassphrase: "incorrectamundo"
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).catch(err => {
          err.message.should.eql(
            "error starting https server: incorrect ssl passphrase"
          )
          done()
        })
      })
    })

    it("should return 200 ok when using protected ssl key with a passphrase", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          sslPrivateKeyPath: "test/ssl/protected/key.pem",
          sslCertificatePath: "test/ssl/protected/cert.pem",
          sslPassphrase: "changeme"
        }
      }

      var method = sinon.spy(Controller.Controller.prototype, "get")

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get("/test").end(function(err, res) {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })
  })

  describe("protocol redirect", function() {
    it("should redirect to http when protocol is http and X-Forwarded-Proto = https", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "http"
        },
        security: {
          trustProxy: true
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get("/test")
            .set("X-Forwarded-Proto", "https")
            .expect(301)
            .end(function(err, res) {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it("should redirect http request to https when redirectPort is set", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        server: {
          protocol: "https",
          redirectPort: 9999,
          sslPrivateKeyPath: "test/ssl/unprotected/key.pem",
          sslCertificatePath: "test/ssl/unprotected/cert.pem"
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          var httpClient = request(
            "http://" + config.get("server.host") + ":9999"
          )
          httpClient
            .get("/test")
            .expect(302)
            .end(function(err, res) {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })

  describe("domain redirect", function() {
    it("should redirect to specified domain when rewrites.forceDomain is configured", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        rewrites: {
          forceDomain: "example.com"
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/test").end((err, res) => {
            should.exist(res.headers.location)
            res.headers.location.should.eql("http://example.com:80/test")
            res.statusCode.should.eql(301)
            if (err) return done(err)
            done()
          })
        })
      })
    })

    it("should redirect to specified domain and port when rewrites.forceDomain is configured", function(
      done
    ) {
      var pages = TestHelper.setUpPages()

      var configUpdate = {
        rewrites: {
          forceDomain: "example.com:81"
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get("/test").end((err, res) => {
            should.exist(res.headers.location)
            res.headers.location.should.eql("http://example.com:81/test")
            res.statusCode.should.eql(301)
            if (err) return done(err)
            done()
          })
        })
      })
    })
  })
})
