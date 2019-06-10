const fs = require('fs')
const path = require('path')
const should = require('should')

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

  it('should fire `change` event when watched path changes', done => {
    const p = path.join(__dirname, 'test.txt')

    let server = Server({})

    let called = false

    server.addMonitor(p, () => {
      if (!called) {
        called = true
        setTimeout(() => {
          done()
        }, 1000)
      }
    })

    setTimeout(() => {
      fs.writeFile(p, 'Hello World', err => {})
    }, 1000)
  })
})
