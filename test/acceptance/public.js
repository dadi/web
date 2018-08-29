var fs = require('fs')
var nock = require('nock')
var path = require('path')
var should = require('should')
var Readable = require('stream').Readable
var request = require('supertest')
var zlib = require('zlib')

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var Datasource = require(__dirname + '/../../dadi/lib/datasource')
var help = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var controller

var secureClientHost =
  'https://' + config.get('server.host') + ':' + config.get('server.port')
var secureClient = request(secureClientHost)
var scope

// Ignore errors around self-assigned SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

describe('Public folder', function (done) {
  beforeEach(function (done) {
    TestHelper.clearCache()

    var apiHost =
      'http://' + config.get('api.host') + ':' + config.get('api.port')
    scope = nock(apiHost)
      .post('/token')
      .times(5)
      .reply(200, { accessToken: 'xx' })

    var scope1 = nock(apiHost)
      .get('/')
      .reply(200)

    var configUpdate = {
      server: {
        host: '127.0.0.1',
        port: 5000
      }
    }

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function (done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  // beforeEach(function(done) {
  //   TestHelper.resetConfig().then(() => {
  //     TestHelper.disableApiConfig().then(() => {
  //       done()
  //     })
  //   })
  // })

  // afterEach(function(done) {
  //   TestHelper.stopServer(done)
  // })

  it('should compress files in the public folder where necessary', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({}).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        client
          .get('/gzipme.css')
          .set('accept-encoding', 'gzip')
          .end((err, res) => {
            res.headers['content-encoding'].should.eql('gzip')
            done()
          })
      })
    })
  })

  it('should cache compressible files in the public folder where necessary', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var cacheConfig = {
      caching: {
        directory: {
          enabled: true
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')

        request(connectionString)
          .get('/gzipme.css')
          .set('accept-encoding', 'gzip')
          .end((err, res) => {
            request(connectionString)
              .get('/gzipme.css')
              .set('accept-encoding', 'gzip')
              .end((err, res) => {
                res.headers['x-cache'].should.eql('HIT')
                res.headers['content-encoding'].should.eql('gzip')
                done()
              })
          })
      })
    })
  })

  it('should not cache compressible files in the public folder when cache is disabled', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var cacheConfig = {
      caching: {
        directory: {
          enabled: false
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        client
          .get('/gzipme.css')
          .set('accept-encoding', 'gzip')
          .end((err, res) => {
            should.not.exist(res.headers['x-cache'])
            res.headers['content-encoding'].should.eql('gzip')
            done()
          })
      })
    })
  })

  it('should return files from the public folder', function (done) {
    var pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      var connectionString =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var client = request(connectionString)

      client.get('/image.png').end((err, res) => {
        should.exist(res.headers['content-type'])
        res.headers['content-type'].should.eql('image/png')
        res.headers['cache-control'].should.eql('public, max-age=86400')
        done()
      })
    })
  })

  it('should not compress images in the public folder', function (done) {
    var pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      var connectionString =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var client = request(connectionString)

      client.get('/image.png').end((err, res) => {
        should.not.exist(res.headers['content-encoding'])
        done()
      })
    })
  })

  it('should return files from a config.virtualDirectories folder', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/testing.html').end((err, res) => {
          res.text.should.eql('My name is testing.html')
          done()
        })
      })
    })
  })

  it('should return an index file if specified for a config.virtualDirectories folder', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir',
          index: 'index.html'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/').end((err, res) => {
          res.text.should.eql('My name is index.html')
          done()
        })
      })
    })
  })

  it('should return an index files if specified as an array for a config.virtualDirectories folder', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir',
          index: ['index.html', 'default.html']
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/').end((err, res) => {
          res.text.should.eql('My name is index.html')

          client.get('/virtualdir/subfolder/').end((err, res) => {
            res.text.should.eql('Sub folder default.html')
            done()
          })
        })
      })
    })
  })

  it('should NOT return an index file if NOT specified for a config.virtualDirectories folder', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    var virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')
        var client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/').end((err, res) => {
          res.statusCode.should.eql(404)
          done()
        })
      })
    })
  })

  it('should respond to a range header from the client with the specified partial of the file', function (done) {
    var pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      var connectionString =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var client = request(connectionString)

      client
        .get('/blank1second.mp4')
        .set('range', 'bytes=0-1')
        .end((err, res) => {
          res.headers['content-range'].should.eql('bytes 0-1/15023')
          done()
      })
    })
  })
})
