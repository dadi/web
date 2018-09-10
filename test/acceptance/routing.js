const nock = require('nock')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const cache = require(`${__dirname}/../../dadi/lib/cache`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const page = require(`${__dirname}/../../dadi/lib/page`)
const TestHelper = require(`${__dirname}/../help`)()
const Server = require(`${__dirname}/../../dadi/lib`)
const config = require(path.resolve(path.join(__dirname, '/../../config')))

let clientHost
let secureClientHost
let apiHost
let credentials
let client
let secureClient
let scope

describe('Routing', done => {
  before(done => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  after(done => {
    delete require.cache[path.resolve(path.join(__dirname, '/../../config'))]

    TestHelper.updateConfig({
      server: {
        host: '127.0.0.1',
        port: 5111,
        redirectPort: 0,
        protocol: 'http'
      },
      rewrites: {
        forceDomain: ''
      }
    }).then(() => {
      TestHelper.stopServer(done)
    })
  })

  beforeEach(done => {
    // scope = nock(apiHost).post('/token').reply(200, { accessToken: 'xx' })
    const configUpdate = {
      server: {
        enabled: true,
        host: '127.0.0.1',
        port: 5000,
        redirectPort: 0,
        protocol: 'http'
      }
    }

    TestHelper.setupApiIntercepts()

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        clientHost = `http://${config.get('server.host')}:${config.get(
          'server.port'
        )}`
        secureClientHost = `https://${config.get('server.host')}:${config.get(
          'server.port'
        )}`

        apiHost = `http://${config.get('api').host}:${config.get('api').port}`
        credentials = {
          clientId: config.get('auth.clientId'),
          secret: config.get('auth.secret')
        }

        client = request(clientHost)
        secureClient = request(secureClientHost)

        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  it('should reject requests with no hostname', done => {
    const pages = TestHelper.setUpPages()

    TestHelper.startServer(pages).then(() => {
      client
        .get('/test')
        .set('Host', '')
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
    })
  })

  describe('req.protocol', () => {
    it('should add req.protocol = http when server.protocol is http', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          host: '127.0.0.1',
          port: 5000,
          protocol: 'http'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/test').end((err, res) => {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            const req = method.firstCall.args[0]
            req.protocol.should.exist
            req.protocol.should.eql('http')
            done()
          })
        })
      })
    })

    it('should add req.protocol = https when server.protocol is https', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get('/test').end((err, res) => {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            const req = method.firstCall.args[0]
            req.protocol.should.exist
            req.protocol.should.eql('https')
            done()
          })
        })
      })
    })

    it('should use X-Forwarded-Proto header when trustProxy is true', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        },
        security: {
          trustProxy: true
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient
            .get('/test')
            .set('X-Forwarded-Proto', 'https')
            .end((err, res) => {
              if (err) return done(err)

              method.restore()
              const req = method.firstCall.args[0]
              req.protocol.should.exist
              req.protocol.should.eql('https')
              done()
            })
        })
      })
    })
  })

  describe('req.secure', () => {
    it('should add req.secure = false when server.protocol is http', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          host: '127.0.0.1',
          port: 5000,
          protocol: 'http'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/test').end((err, res) => {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            const req = method.firstCall.args[0]
            req.secure.should.exist
            req.secure.should.eql(false)
            done()
          })
        })
      })
    })

    it('should add req.secure = true when server.protocol is https', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          host: '127.0.0.1',
          port: 5000,
          protocol: 'https'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get('/test').end((err, res) => {
            if (err) return done(err)

            method.restore()
            method.calledOnce.should.eql(true)

            const req = method.firstCall.args[0]
            req.secure.should.exist
            req.secure.should.eql(true)
            done()
          })
        })
      })
    })
  })

  describe('req.ip', () => {
    it('should add ip from socket when trustProxy is false', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: false
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ip = '54.53.78.111'
          client
            .get('/test')
            .set('X-Forwarded-For', ip)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql('127.0.0.1')
              done()
            })
        })
      })
    })

    it('should add ip from X-Forwarded-For when trustProxy is true', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ip = '54.53.78.111'
          client
            .get('/test')
            .set('X-Forwarded-For', ip)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ip)
              done()
            })
        })
      })
    })

    it('should use left-most ip from X-Forwarded-For when trustProxy is true', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ips = ['54.53.78.111', '55.50.13.100']
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql(ips[0])
              done()
            })
        })
      })
    })

    it('should use first untrusted ip from X-Forwarded-For when trustProxy is an array of ips', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: ['127.0.0.1', '36.227.220.163']
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ips = '36.227.220.63, 36.227.220.163'
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ip.should.exist
              req.ip.should.eql('36.227.220.63')
              done()
            })
        })
      })
    })
  })

  describe('req.ips', () => {
    it('should add ips from socket when trustProxy is false', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: false
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ips = ['54.53.78.111', '55.50.13.100']
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ips.should.exist
              req.ip.should.eql('127.0.0.1')
              done()
            })
        })
      })
    })

    it('should add ips from X-Forwarded-For when trustProxy is true', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const ips = ['54.53.78.111', '55.50.13.100']
          client
            .get('/test')
            .set('X-Forwarded-For', ips)
            .end((err, res) => {
              if (err) return done(err)

              method.restore()

              const req = method.firstCall.args[0]
              req.ips.should.exist
              req.ips.should.eql(ips)
              done()
            })
        })
      })
    })
  })

  describe('https with unprotected ssl key', () => {
    it('should return 200 ok when using unprotected ssl key without a passphrase', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get('/test').end((err, res) => {
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

  describe('https with protected ssl key', () => {
    it('should throw a bad password read exception when using protected ssl key without a passphrase', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem'
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).catch(err => {
          err.message.should.startWith('error starting https server')
          done()
        })
      })
    })

    it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem',
          sslPassphrase: 'incorrectamundo'
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).catch(err => {
          err.message.should.startWith('error starting https server')
          done()
        })
      })
    })

    it('should return 200 ok when using protected ssl key with a passphrase', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          sslPrivateKeyPath: 'test/ssl/protected/key.pem',
          sslCertificatePath: 'test/ssl/protected/cert.pem',
          sslPassphrase: 'changeme'
        }
      }

      const method = sinon.spy(Controller.Controller.prototype, 'get')

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          secureClient.get('/test').end((err, res) => {
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

  describe('protocol redirect', () => {
    it('should redirect to http when protocol is http and X-Forwarded-Proto = https', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'http'
        },
        security: {
          trustProxy: true
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/test')
            .set('X-Forwarded-Proto', 'https')
            .expect(301)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should redirect http request to https when redirectPort is set', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        server: {
          protocol: 'https',
          redirectPort: 9999,
          sslPrivateKeyPath: 'test/ssl/unprotected/key.pem',
          sslCertificatePath: 'test/ssl/unprotected/cert.pem'
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          const httpClient = request(`http://${config.get('server.host')}:9999`)
          httpClient
            .get('/test')
            .expect(302)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })

  describe('domain redirect', () => {
    it('should redirect to specified domain when rewrites.forceDomain is configured', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        rewrites: {
          forceDomain: 'example.com'
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/test').end((err, res) => {
            should.exist(res.headers.location)
            res.headers.location.should.eql('http://example.com:80/test')
            res.statusCode.should.eql(301)
            if (err) return done(err)
            done()
          })
        })
      })
    })

    it('should redirect to specified domain and port when rewrites.forceDomain is configured', done => {
      const pages = TestHelper.setUpPages()

      const configUpdate = {
        rewrites: {
          forceDomain: 'example.com:81'
        }
      }

      TestHelper.updateConfig(configUpdate).then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/test').end((err, res) => {
            should.exist(res.headers.location)
            res.headers.location.should.eql('http://example.com:81/test')
            res.statusCode.should.eql(301)
            if (err) return done(err)
            done()
          })
        })
      })
    })
  })
})
