const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const request = require('supertest')

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

const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

let scope

// Ignore errors around self-assigned SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

describe('Upload', done => {
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

  after(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  it('should populate the req.files property with uploaded files', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      security: {
        csrf: false
      },
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hashKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .post('/allowed-upload-route/')
          .attach('avatar', './test/app/images/rosie.png')
          .end((err, res) => {
            const expectedData = res.body
            should.exist(expectedData.files)
            expectedData.files.should.be.Array
            should.exist(expectedData.files[0])
            expectedData.files[0].fieldname.should.eql('avatar')
            expectedData.files[0].path.should.eql('test/app/uploads/rosie.png')
            done()
          })
      })
    })
  })

  it('should allow fields and files when posting data', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      security: {
        csrf: false
      },
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hashKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .post('/allowed-upload-route/')
          .field('name', 'my avatar')
          .attach('avatar', './test/app/images/rosie.png')
          .end((err, res) => {
            const expectedData = res.body
            should.exist(expectedData.files)
            expectedData.files.should.be.Array
            should.exist(expectedData.files[0])
            expectedData.files[0].fieldname.should.eql('avatar')
            expectedData.files[0].path.should.eql('test/app/uploads/rosie.png')
            done()
          })
      })
    })
  })

  it('should work when CSRF security is enabled', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      security: {
        csrf: true
      },
      allowDebugView: true,
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hashKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client.get('/allowed-upload-route/?debug=json').end((err, res) => {
          const token = res.body.csrfToken

          should.exist(res)

          client
            .post('/allowed-upload-route/')
            .set(
              'Cookie',
              `_csrf=${TestHelper.extractCookieValue(res, '_csrf')}`
            )
            .field('_csrf', token.toString())
            .attach('avatar', './test/app/images/rosie.png')
            .end((err, res2) => {
              const expectedData = res2.body
              should.exist(expectedData.files)
              expectedData.files.should.be.Array
              should.exist(expectedData.files[0])
              expectedData.files[0].fieldname.should.eql('avatar')
              expectedData.files[0].path.should.eql(
                'test/app/uploads/rosie.png'
              )

              should.exist(expectedData.body._csrf)
              expectedData.body._csrf.should.eql(token)
              done()
            })
        })
      })
    })
  })

  it('should hash the filename', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      security: {
        csrf: false
      },
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: true,
        hashKey: 'abcdef',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    const expected = `${require('crypto')
      .createHmac('sha1', 'abcdef')
      .update('rosie.png')
      .digest('hex')}.png`

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .post('/allowed-upload-route/')
          .attach('avatar', './test/app/images/rosie.png')
          .end((err, res) => {
            const expectedData = res.body
            expectedData.files[0].filename.should.not.eql('rosie.png')
            done()
          })
      })
    })
  })

  it('should save the uploaded file to the upload path', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      security: {
        csrf: false
      },
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hashKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .post('/allowed-upload-route/')
          .attach('avatar', './test/app/images/rosie.png')
          .end((err, res) => {
            fs.stat('test/app/uploads/rosie.png', (err, stat) => {
              should.exist(stat)
              done()
            })
          })
      })
    })
  })

  it('should not populate the req.files property for a non whitelist route', done => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{ path: '/allowed-upload-route' }]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    pages.push(Object.assign({}, pages[0]))
    pages[1].routes = [{ path: '/non-allowed-upload-route' }]

    const uploadConfig = {
      security: {
        csrf: false
      },
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hashKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false,
        whitelistRoutes: ['/allowed-upload-route']
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .post('/non-allowed-upload-route/')
          .attach('avatar', './test/app/images/rosie.png')
          .end((err, res) => {
            const expectedData = res.body
            should.exist(expectedData.files)
            Object.keys(expectedData.files).length.should.eql(0)
            done()
          })
      })
    })
  })
})
