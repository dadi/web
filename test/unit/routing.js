var _ = require('underscore')
var fs = require('fs')
var request = require('supertest')
var should = require('should')
var sinon = require('sinon')
var path = require('path')

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var libHelp = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')
var Router = require(__dirname + '/../../dadi/lib/controller/router')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()
var config = require(path.resolve(path.join(__dirname, '/../../config')))

var httpConnectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var httpsConnectionString = 'https://' + config.get('server.host') + ':' + config.get('server.port')
var client = request(httpConnectionString)
var secureClient = request(httpsConnectionString)

var method
var originalConfig

describe('Routing', function(done) {

  before(function(done) {
    TestHelper.getConfig().then(config => {
      originalConfig = config
      TestHelper.resetConfig().then(() => {
        // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        done()
      })
    })
  })

  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        method = sinon.spy(Controller.Controller.prototype, 'get')
        done()
      })
    })
  })

  after(function(done) {
    TestHelper.updateConfig(originalConfig).then(() => {
      done()
    })
  })

  afterEach(function(done) {
    TestHelper.resetConfig().then(() => {
      method.restore()
      TestHelper.stopServer(done)
    })
  })

  /**
   * Specificall designed to reject requests such as "/w00tw00t.at.ISC.SANS.DFind:)"
   */
  it('should reject requests with no hostname', function(done) {
    var pages = TestHelper.setUpPages()
    TestHelper.startServer(pages).then(() => {
      client
        .get('/test')
        .set('Host', '')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  describe('req.protocol', function() {
    it('should add req.protocol = http when server.protocol is http', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              method.calledOnce.should.eql(true)
              var req = method.firstCall.args[0]
              req.protocol.should.exist
              req.protocol.should.eql('http')
              done()
            })
        })
      })
    })

    it('should add req.protocol = https when server.protocol is https', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              method.calledOnce.should.eql(true)
              var req = method.firstCall.args[0]
              req.protocol.should.exist
              req.protocol.should.eql('https')
              done()
            })
        })
      })
    })

    it('should use X-Forwarded-Proto header when trustProxy is true', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        },
        security: {
          trustProxy: true
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .set('X-Forwarded-Proto', 'https')
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.protocol.should.exist
              req.protocol.should.eql('https')
              done()
            })
        })
      })
    })
  })

  describe('req.secure', function() {
    it('should add req.secure = false when server.protocol is http', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.secure.should.exist
              req.secure.should.eql(false)
              done()
            })
        })
      })
    })

    it('should add req.secure = true when server.protocol is https', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.secure.should.exist
              req.secure.should.eql(true)
              done()
            })
        })
      })
    })
  })

  describe('req.ip', function() {
    it('should add ip from socket when trustProxy is false', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: false
        }
      }).then(() => {
        var ip = '54.53.78.111'
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ip)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql('127.0.0.1')
              done()
            })
        })
      })
    })

    it('should add ip from X-Forwarded-For when trustProxy is true', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }).then(() => {
        var ip = '54.53.78.111'
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ip)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ip)
              done()
            })
        })
      })
    })

    it('should use left-most ip from X-Forwarded-For when trustProxy is true', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }).then(() => {
        var ips = ['54.53.78.111', '55.50.13.100']
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ips[0])
              done()
            })
        })
      })
    })

    it('should use first untrusted ip from X-Forwarded-For when trustProxy is an array of ips', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: ['127.0.0.1','36.227.220.163']
        }
      }).then(() => {
        var ips = '36.227.220.63, 36.227.220.163'
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql('36.227.220.63')
              done()
            })
        })
      })
    })
  })

  describe('req.ips', function() {
    it('should add ips from socket when trustProxy is false', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: false
        }
      }).then(() => {
        var ips = ['54.53.78.111', '55.50.13.100']
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql('127.0.0.1')
              done()
            })
        })
      })
    })

    //
    // fails: expected '54.53.78.111' to equal Array [ '54.53.78.111', '55.50.13.100' ]
    //
    it.skip('should add ips from X-Forwarded-For when trustProxy is true', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }).then(() => {
        var ips = ['54.53.78.111', '55.50.13.100']
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end(function (err, res) {
              if (err) return done(err)

              var req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ips)
              done()
            })
        })
      })
    })
  })

  describe('https with unprotected ssl key', function() {
    it('should return 200 ok when using unprotected ssl key without a passphrase', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              method.calledOnce.should.eql(true)
              res.statusCode.should.eql(200)
              done()
            })
        })
      })
    })
  })

  describe('https with protected ssl key', function() {
    it('should throw a bad password read exception when using protected ssl key without a passphrase', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem'
        }
      }).then(() => {
        try {
          var pages = TestHelper.setUpPages()
          TestHelper.startServer(pages)
        } catch (ex) {
          ex.message.should.eql('error starting https server: required ssl passphrase not provided')
        }

        done()
      })
    })

    it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem',
          sslPassphrase: 'incorrectamundo'
        }
      }).then(() => {
        try {
          var pages = TestHelper.setUpPages()
          TestHelper.startServer(pages)
        } catch (ex) {
          ex.message.should.eql('error starting https server: incorrect ssl passphrase')
        }

        done()
      })
    })

    it('should return 200 ok when using protected ssl key with a passphrase', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem',
          sslPassphrase: 'changeme'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .end(function (err, res) {
              if (err) return done(err)

              method.calledOnce.should.eql(true)
              res.statusCode.should.eql(200)
              done()
            })
        })
      })
    })
  })

  describe('protocol redirect', function() {
    it('should redirect to http when protocol is http and X-Forwarded-Proto = https', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-Proto', 'https')
            .expect(301)
            .end(function (err, res) {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should redirect http request to https when redirectPort is set', function(done) {
      TestHelper.updateConfig({
        server: {
          protocol: 'https',
          redirectPort: 8010,
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }).then(() => {
        var pages = TestHelper.setUpPages()
        TestHelper.startServer(pages).then(() => {
          var httpClient = request('http://' + config.get('server.host') + ':8010')
          httpClient
            .get('/test')
            .expect(301)
            .end(function (err, res) {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })
})
