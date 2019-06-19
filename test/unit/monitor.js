const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const monitor = require(`${__dirname}/../../dadi/lib/monitor`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()

describe('Monitor', done => {
  before(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  after(done => {
    try {
      fs.unlinkSync(path.join(__dirname, 'test.txt'))
    } catch (err) {}
    done()
  })

  it('should export constructor', done => {
    monitor.Monitor.should.be.a.Function
    done()
  })

  it('should export function that returns an instance', done => {
    monitor.should.be.a.Function
    const p = __dirname
    monitor(p).should.be.an.instanceOf(monitor.Monitor)
    done()
  })

  it('should fire `change` event when watched path changes', done => {
    const p = path.join(__dirname, 'test.txt')

    fs.writeFile(p, 'Hello World', err => {
      const m = monitor(p)
      m.on('change', fileName => {
        fileName.should.eql('test.txt')
      })

      m.close()

      done()
    })
  })
})
