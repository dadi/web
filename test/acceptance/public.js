const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const Readable = require('stream').Readable
const request = require('supertest')
const zlib = require('zlib')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()

const config = require(path.resolve(path.join(__dirname, '/../../config')))
let controller

const secureClientHost = `https://${config.get('server.host')}:${config.get(
  'server.port'
)}`
const secureClient = request(secureClientHost)
let scope

// Ignore errors around self-assigned SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

describe('Public folder', done => {
  beforeEach(done => {
    TestHelper.clearCache()

    const apiHost = `http://${config.get('api.host')}:${config.get('api.port')}`
    scope = nock(apiHost)
      .post('/token')
      .times(5)
      .reply(200, { accessToken: 'xx' })

    const scope1 = nock(apiHost)
      .get('/')
      .reply(200)

    const configUpdate = {
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

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  it('should compress files in the public folder where necessary', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.updateConfig({}).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

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

  it('should cache compressible files in the public folder where necessary', done => {
    const pages = TestHelper.setUpPages()

    const cacheConfig = {
      caching: {
        directory: {
          enabled: true
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`

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

  it('should not cache compressible files in the public folder when cache is disabled', done => {
    const pages = TestHelper.setUpPages()

    const cacheConfig = {
      caching: {
        directory: {
          enabled: false
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

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

  it('should return files from the public folder', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      const connectionString = `http://${config.get(
        'server.host'
      )}:${config.get('server.port')}`
      const client = request(connectionString)

      client.get('/image.png').end((err, res) => {
        should.exist(res.headers['content-type'])
        res.headers['content-type'].should.eql('image/png')
        res.headers['cache-control'].should.eql('public, max-age=86400')
        done()
      })
    })
  })

  it('should return files from the public folder with names containing spaces', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      const connectionString = `http://${config.get(
        'server.host'
      )}:${config.get('server.port')}`
      const client = request(connectionString)

      client
        .get('/' + encodeURI('&ima ge.png'))
        .expect(200)
        .end((err, res) => {
          if (err) console.log(err)

          should.exist(res.headers)
          res.headers['content-type'].should.eql('image/png')
          res.headers['cache-control'].should.eql('public, max-age=86400')
          done()
        })
    })
  })

  it('should not compress images in the public folder', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      const connectionString = `http://${config.get(
        'server.host'
      )}:${config.get('server.port')}`
      const client = request(connectionString)

      client.get('/image.png').end((err, res) => {
        should.not.exist(res.headers['content-encoding'])
        done()
      })
    })
  })

  it('should return files from a config.virtualDirectories folder', done => {
    const pages = TestHelper.setUpPages()

    const virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/testing.html').end((err, res) => {
          res.text.should.eql('My name is testing.html')
          done()
        })
      })
    })
  })

  it('should return an index file if specified for a config.virtualDirectories folder', done => {
    const pages = TestHelper.setUpPages()

    const virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir',
          index: 'index.html'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/').end((err, res) => {
          res.text.should.eql('My name is index.html')
          done()
        })
      })
    })
  })

  it('should return an index files if specified as an array for a config.virtualDirectories folder', done => {
    const pages = TestHelper.setUpPages()

    const virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir',
          index: ['index.html', 'default.html']
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

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

  it('should NOT return an index file if NOT specified for a config.virtualDirectories folder', done => {
    const pages = TestHelper.setUpPages()

    const virtualConfig = {
      virtualDirectories: [
        {
          path: './test/app/virtualdir'
        }
      ]
    }

    TestHelper.updateConfig(virtualConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const client = request(connectionString)

        // Serve the readme for Web
        client.get('/virtualdir/').end((err, res) => {
          res.statusCode.should.eql(404)
          done()
        })
      })
    })
  })

  it('should respond to a range header from the client with the specified partial of the file', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      const connectionString = `http://${config.get(
        'server.host'
      )}:${config.get('server.port')}`
      const client = request(connectionString)

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
