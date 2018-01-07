const fs = require('fs')
const nock = require('nock')
const path = require('path')
const should = require('should')
const request = require('supertest')

const api = require(__dirname + '/../../dadi/lib/api')
const Bearer = require(__dirname + '/../../dadi/lib/auth/bearer')
const Controller = require(__dirname + '/../../dadi/lib/controller')
const Datasource = require(__dirname + '/../../dadi/lib/datasource')
const help = require(__dirname + '/../../dadi/lib/help')
const Page = require(__dirname + '/../../dadi/lib/page')
const Server = require(__dirname + '/../../dadi/lib')
const TestHelper = require(__dirname + '/../help')()

const config = require(path.resolve(path.join(__dirname, '/../../config')))
let controller

const secureClientHost =
  'https://' + config.get('server.host') + ':' + config.get('server.port')
const secureClient = request(secureClientHost)

const connectionString =
          'http://' +
          config.get('server.host') +
          ':' +
          config.get('server.port')

let scope

// Ignore errors around self-assigned SSL certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

describe('Upload', function (done) {
  beforeEach(function (done) {
    TestHelper.clearCache()

    const apiHost =
      'http://' + config.get('api.host') + ':' + config.get('api.port')
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

  it('should populate the req.files property with uploaded files', (done) => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{path: '/allowed-upload-route'}]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hasKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
        .post('/allowed-upload-route/')
        // .field('name', 'avatar')
        .attach('avatar', './test/app/images/rosie.png')
        .end((err, res) => {
          const files = res.body
          should.exist(files)
          files.should.be.Array
          should.exist(files[0])
          files[0].fieldname.should.eql('avatar')
          files[0].path.should.eql('test/app/uploads/rosie.png')
          done()
        })
      })
    })
  })

  it('should allow fields and files when posting data', (done) => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{path: '/allowed-upload-route'}]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hasKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false
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
          console.log(res.body)
          const files = res.body
          should.exist(files)
          files.should.be.Array
          should.exist(files[0])
          files[0].fieldname.should.eql('avatar')
          files[0].path.should.eql('test/app/uploads/rosie.png')
          done()
        })
      })
    })
  })

  it('should hash the filename', (done) => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{path: '/allowed-upload-route'}]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: true,
        hasKey: 'abcdef',
        prefix: '',
        prefixWithFieldName: false
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
        .post('/allowed-upload-route/')
        // .field('name', 'avatar')
        .attach('avatar', './test/app/images/rosie.png')
        .end((err, res) => {
          const files = res.body
          files[0].filename.should.not.eql('rosie.png')
          done()
        })
      })
    })
  })

  it('should save the uploaded file to the upload path', (done) => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{path: '/allowed-upload-route'}]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hasKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
        .post('/allowed-upload-route/')
        // .field('name', 'avatar')
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

  it('should not populate the req.files property for a non whitelist route', (done) => {
    const pages = TestHelper.setUpPages()

    pages[0].routes = [{path: '/allowed-upload-route'}]
    pages[0].contentType = 'application/json'
    pages[0].template = 'upload.js'
    pages[0].events = ['upload']

    const uploadConfig = {
      uploads: {
        enabled: true,
        destinationPath: './test/app/uploads',
        hashFilename: false,
        hasKey: 'abcedf',
        prefix: '',
        prefixWithFieldName: false
      }
    }

    TestHelper.updateConfig(uploadConfig).then(() => {
      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
        .post('/not-allowed-upload-route/')
        // .field('name', 'avatar')
        .attach('avatar', './test/app/images/rosie.png')
        .end((err, res) => {
          const files = res.body
          should.exist(files)
          Object.keys(files).length.should.eql(0)
          done()
        })
      })
    })
  })
})
