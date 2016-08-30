var fs = require('fs')
var sinon = require('sinon')
var should = require('should')
var request = require('supertest')
var mkdirp = require('mkdirp')
var _ = require('underscore')
var path = require('path')
var assert = require('assert')
var nock = require('nock')

var Server = require(__dirname + '/../../dadi/lib')
var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var Page = require(__dirname + '/../../dadi/lib/page')
var help = require(__dirname + '/../help')
var libHelp = require(__dirname + '/../../dadi/lib/help')
var config = require(path.resolve(path.join(__dirname, '/../../config')))

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var secureClientHost = 'https://' + config.get('server.host') + ':' + config.get('server.port')

var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port')
var credentials = { clientId: config.get('auth.clientId'), secret: config.get('auth.secret') }

var client = request(clientHost)
var secureClient = request(secureClientHost)

var scope
var method

describe('Routing', function(done) {

  before(function(done) {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach(function(done) {
    help.clearCache()

    // intercept the api test at server startup
    sinon.stub(libHelp, "isApiAvailable").yields(null, true)

    scope = nock('http://127.0.0.1:3000').post('/token').reply(200, { accessToken: 'xx' })
    method = sinon.spy(Controller.Controller.prototype, 'get')

    done()
  })

  after(function(done) {
    help.clearCache()
    nock.restore()
    help.stopServer(done)
  })

  afterEach(function(done) {
    libHelp.isApiAvailable.restore()
    nock.cleanAll()
    method.restore()
    help.stopServer(done)

    config.set('security.useSSL', false)
    config.set('security.trustProxy', false)

    config.set('server.protocol', 'http')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')
  })

  /**
   * Specificall designed to reject requests such as "/w00tw00t.at.ISC.SANS.DFind:)"
   */
  it('should reject requests with no hostname', function(done) {

    help.startServer(help.setUpPages(), function() {
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
      config.set('server.protocol', 'http')
      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

    it('should add req.protocol = https when server.protocol is https', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

      help.startServer(help.setUpPages(), function() {
        secureClient.get('/test')
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

    it('should use X-Forwarded-Proto header when trustProxy is true', function(done) {
      //config.set('security.useSSL', true)
      config.set('security.trustProxy', true)
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

      help.startServer(help.setUpPages(), function() {
        secureClient.get('/test')
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

  describe('req.secure', function() {
    it('should add req.secure = false when server.protocol is http', function(done) {
      help.startServer(help.setUpPages(), function() {
        client.get('/test')
        .end(function (err, res) {
          if (err) return done(err)

          var req = method.firstCall.args[0]
          req.secure.should.exist
          req.secure.should.eql(false)
          done()
        })
      })
    })

    it('should add req.secure = true when server.protocol is https', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

      help.startServer(help.setUpPages(), function() {
        secureClient.get('/test')
        .end(function (err, res) {
          if (err) return done(err)

          method.calledOnce.should.eql(true)
          var req = method.firstCall.args[0]
          req.secure.should.exist
          req.secure.should.eql(true)
          done()
        })
      })
    })
  })

  describe('req.ip', function() {
    it('should add ip from socket when trustProxy is false', function(done) {
      config.set('security.trustProxy', false)

      var ip = '54.53.78.111'

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

    it('should add ip from X-Forwarded-For when trustProxy is true', function(done) {
      config.set('security.trustProxy', true)

      var ip = '54.53.78.111'

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

    it('should use left-most ip from X-Forwarded-For when trustProxy is true', function(done) {
      config.set('security.trustProxy', true)

      var ips = ['54.53.78.111', '55.50.13.100']

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

    it('should use first untrusted ip from X-Forwarded-For when trustProxy is an array of ips', function(done) {

      var ips = '36.227.220.63, 36.227.220.163'

      config.set('security.trustProxy', ['127.0.0.1','36.227.220.163'])

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

  describe('req.ips', function() {
    it('should add ips from socket when trustProxy is false', function(done) {
      config.set('security.trustProxy', false)

      var ips = ['54.53.78.111', '55.50.13.100']

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
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

    it('should add ips from X-Forwarded-For when trustProxy is true', function(done) {
      config.set('security.trustProxy', true)

      var ips = ['54.53.78.111', '55.50.13.100']

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
        .set('X-Forwarded-For', ips)
        .end(function (err, res) {
          if (err) return done(err)

          var req = method.firstCall.args[0]
          req.ips.should.exist
          req.ips.should.eql(ips)
          done()
        })
      })
    })
  })

  describe.skip('protocol redirect', function() {
    it('should redirect to http when useSSL is false and X-Forwarded-Proto = https', function(done) {
      config.set('security.useSSL', false)
      config.set('security.trustProxy', true)

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
        .set('X-Forwarded-Proto', 'https')
        .expect(301)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
      })
    })

    it('should redirect to https when useSSL is true and X-Forwarded-Proto = http', function(done) {
      config.set('security.useSSL', true)
      config.set('security.trustProxy', true)

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
        .set('X-Forwarded-Proto', 'http')
        .expect(301)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
      })
    })

    it('should not redirect when useSSL is true and X-Forwarded-Proto = http and trustProxy = false', function(done) {
      config.set('security.useSSL', true)
      config.set('security.trustProxy', false)

      help.startServer(help.setUpPages(), function() {
        client.get('/test')
        .set('X-Forwarded-Proto', 'http')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
      })
    })
  })

  describe('https with unprotected ssl key', function() {
    it('should return 200 ok when using unprotected ssl key without a passphrase', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

      help.startServer(help.setUpPages(), function() {
        secureClient.get('/test')
        .end(function (err, res) {
          if (err) return done(err)

          method.calledOnce.should.eql(true)
          res.statusCode.should.eql(200)
          done()
        })
      })
    })
  })

  describe('https with protected ssl key', function() {
    it('should throw a bad password read exception when using protected ssl key without a passphrase', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')

      try {
        help.startServer(help.setUpPages(), () => {})
      } catch (ex) {
        ex.message.should.eql('error starting https server: required ssl passphrase not provided')
      }

      done()
    })

    it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
      config.set('server.sslPassphrase', 'incorrectamundo')

      try {
        help.startServer(help.setUpPages(), () => {})
      } catch (ex) {
        ex.message.should.eql('error starting https server: incorrect ssl passphrase')
      }

      done()
    })

    it('should return 200 ok when using protected ssl key with a passphrase', function(done) {
      config.set('server.protocol', 'https')
      config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
      config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
      config.set('server.sslPassphrase', 'changeme')

      help.startServer(help.setUpPages(), function() {
        secureClient.get('/test')
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
