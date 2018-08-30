const webEngine = require('web-es6-templates')
const fs = require('fs')
const path = require('path')
const pathToRegexp = require('path-to-regexp')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const page = require(`${__dirname}/../../dadi/lib/page`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()
const view = require(`${__dirname}/../../dadi/lib/view`)

const config = require(path.resolve(path.join(__dirname, '/../../config')))

function cleanupPath (path, done) {
  try {
    fs.unlink(path, () => {
      done()
    })
  } catch (err) {
    console.log(err)
  }
}

describe('View', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it('should export constructor', done => {
    view.View.should.be.Function
    done()
  })

  it('should attach params to View', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()

    const req = { url: '/test' }
    const p = page(name, schema)
    const v = view(req.url, p)

    v.url.should.eql('/test')
    v.page.name.should.eql('test')
    done()
  })

  it('should accept data via `setData()`', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.template = 'test.js'

    const req = { url: '/test' }
    const p = page(name, schema)
    const v = view(req.url, p)

    const data = {
      title: 'Sir',
      names: [
        {
          name: 'Moe'
        },
        {
          name: 'Larry'
        },
        {
          name: 'Curly'
        }
      ]
    }

    v.setData(data)
    v.data.title.should.eql('Sir')
    done()
  })

  it('should return html when calling `render()`', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.template = 'test.js'

    const req = { url: '/test' }
    const p = page(name, schema)
    const v = view(req.url, p)

    const data = {
      names: [
        { title: 'Sir', name: 'Moe' },
        { title: 'Sir', name: 'Larry' },
        { title: 'Sir', name: 'Curly' }
      ]
    }

    v.setData(data)
    v.render((err, result) => {
      if (err) return done(err)
      const expected = 'Sir Moe\nSir Larry\nSir Curly'
      result.should.eql(expected)
      done()
    })
  })

  it('should postProcess the HTML output of a page when set at page level', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.template = 'test.js'
    schema.settings.postProcessors = ['replace-sir']

    const req = { url: '/test' }
    const p = page(name, schema)
    const v = view(req.url, p)

    const data = {
      names: [
        { title: 'Sir', name: 'Moe' },
        { title: 'Sir', name: 'Larry' },
        { title: 'Sir', name: 'Curly' }
      ]
    }

    v.setData(data)

    v.render((err, result) => {
      if (err) return done(err)
      const expected = 'Madam Moe\nMadam Larry\nMadam Curly'
      result.should.eql(expected)
      done()
    })
  })
})
