'use strict'

const fs = require('fs')
const path = require('path')
const sinon = require('sinon')
const should = require('should')

const helpers = require(`${__dirname}/../../dadi/lib/help`)
const TemplateStore = require(`${__dirname}/../../dadi/lib/templates/store`)
  .TemplateStore
const testHelpers = require(`${__dirname}/../help`)()

let additionalFiles
let directoryListing
let config
let pages
let templateStore

beforeEach(done => {
  testHelpers.resetConfig().then(newConfig => {
    config = newConfig

    templateStore = new TemplateStore()

    directoryListing = [
      path.resolve(config.get('paths.pages'), 'page1.js'),
      path.resolve(config.get('paths.pages'), 'page2.js'),
      path.resolve(config.get('paths.pages'), 'sub-dir-1/page3.js'),
      path.resolve(config.get('paths.pages'), 'partials/partial1.js')
    ]

    pages = [
      {
        engine: 'es6',
        file: directoryListing[0]
      },
      {
        engine: 'es6',
        file: directoryListing[1]
      },
      {
        engine: 'es6',
        file: directoryListing[2]
      }
    ]

    additionalFiles = [directoryListing[3]]

    done()
  })
})

describe('Template store', done => {
  describe('Validation', done => {
    it('throw if engine is missing a metadata block', done => {
      const fakeFactory = {}

      try {
        new TemplateStore().validateEngine(fakeFactory, {})
      } catch (err) {
        err.message.indexOf('is missing the metadata block').should.not.eql(-1)

        done()
      }
    })

    it('throw if engine is missing a valid extensions array', done => {
      const fakeFactory = {
        metadata: {
          extensions: '.js'
        }
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, {})
      } catch (err) {
        err.message
          .indexOf(
            'is missing a valid extensions property on the metadata block'
          )
          .should.not.eql(-1)

        done()
      }
    })

    it('throw if engine is missing a valid handle property', done => {
      const fakeFactory1 = {
        metadata: {
          extensions: ['.js']
        }
      }
      const fakeFactory2 = {
        metadata: {
          extensions: ['.js'],
          handle: 12345
        }
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory1, {})
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory2, {})
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing a valid handle property on the metadata block')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing a valid handle property on the metadata block')
        .should.not.eql(-1)

      done()
    })

    it('throw if engine is missing a `getCore()` method', done => {
      const fakeFactory = {
        metadata: {
          extensions: ['.js'],
          handle: 'es6'
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        getCore: 'notAFunction'
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine1)
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine2)
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing the `getCore()` method')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing the `getCore()` method')
        .should.not.eql(-1)

      done()
    })

    it('throw if engine is missing a `getInfo()` method', done => {
      const fakeFactory = {
        metadata: {
          extensions: ['.js'],
          handle: 'es6'
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        getInfo: 'notAFunction'
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine1)
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine2)
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing the `getInfo()` method')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing the `getInfo()` method')
        .should.not.eql(-1)

      done()
    })

    it('throw if engine is missing a `initialise()` method', done => {
      const fakeFactory = {
        metadata: {
          extensions: ['.js'],
          handle: 'es6'
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        initialise: 'notAFunction'
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine1)
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine2)
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing the `initialise()` method')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing the `initialise()` method')
        .should.not.eql(-1)

      done()
    })

    it('throw if engine is missing a `register()` method', done => {
      const fakeFactory = {
        metadata: {
          extensions: ['.js'],
          handle: 'es6'
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        register: 'notAFunction'
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine1)
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine2)
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing the `register()` method')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing the `register()` method')
        .should.not.eql(-1)

      done()
    })

    it('throw if engine is missing a `render()` method', done => {
      const fakeFactory = {
        metadata: {
          extensions: ['.js'],
          handle: 'es6'
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        render: 'notAFunction'
      }

      let err1
      let err2

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine1)
      } catch (err) {
        err1 = err
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, fakeEngine2)
      } catch (err) {
        err2 = err
      }

      err1.message
        .indexOf('is missing the `render()` method')
        .should.not.eql(-1)
      err2.message
        .indexOf('is missing the `render()` method')
        .should.not.eql(-1)

      done()
    })
  })

  describe('loadEngine', () => {
    it('should load template engines', done => {
      templateStore.loadEngines([require('web-es6-templates')])

      templateStore.engines.es6.should.be.Object
      templateStore.engines.es6.factory.should.be.Function
      templateStore.engines.es6.started.should.eql(false)

      done()
    })

    it('should load engine config block onto global config', done => {
      templateStore.loadEngines([require('web-es6-templates')])

      const engine = templateStore.engines.es6
      const engineConfig = config.get('engines.es6')

      engineConfig.should.be.Object

      Object.keys(engine.factory.metadata.config).forEach(property => {
        should.exist(engineConfig[property])
      })

      done()
    })
  })

  describe('loadTemplate', () => {
    it('should start an engine when a template that requires it is loaded', done => {
      templateStore.loadEngines([require('web-es6-templates')])

      templateStore
        .loadTemplate({
          data: '',
          extension: '.js',
          name: 'fakeTemplate1',
          namespace: undefined,
          path: '/fake/path/fakeTemplate1.js'
        })
        .then(loadedTemplate => {
          templateStore.engines.es6.started.should.eql(true)

          done()
        })
    })

    it('should throw an error when loading a template with an extension that is not supported', () => {
      templateStore.loadEngines([require('web-es6-templates')])

      should.throws(() => {
        templateStore.loadTemplate({
          data: '',
          extension: '.foo',
          name: 'fakeTemplate2',
          namespace: undefined,
          path: '/fake/path/fakeTemplate2.foo'
        })
      })
    })

    it('should instantiate the engine and call its `initialise` and `register` methods', done => {
      const mockInitialiseFn = sinon.stub()
      const mockRegisterFn = sinon.stub()

      const fakeEngine = () => {
        const Engine = function () {}

        Engine.prototype.initialise = mockInitialiseFn
        Engine.prototype.getCore = () => {}
        Engine.prototype.getInfo = () => {}
        Engine.prototype.register = mockRegisterFn
        Engine.prototype.render = () => {}

        return Engine
      }

      fakeEngine.metadata = {
        extensions: ['.js'],
        handle: 'es6'
      }

      const templateData = {
        data: 'This is the content of the template',
        extension: '.js',
        name: 'fakeTemplate1',
        namespace: undefined,
        path: '/fake/path/fakeTemplate1.js'
      }

      templateStore.loadEngines([fakeEngine])

      templateStore
        .loadTemplate(templateData)
        .then(response => {
          mockInitialiseFn.calledOnce.should.be.true()
          mockRegisterFn.getCall(0).args[0].should.eql(templateData.name)
          mockRegisterFn.getCall(0).args[1].should.eql(templateData.data)
          mockRegisterFn.getCall(0).args[2].should.eql(templateData.path)

          done()
        })
        .catch(err => {
          console.log('** ERR:', err)
        })
    })
  })

  describe('loadPages', () => {
    it('should all templates corresponding to the given pages, setting any remaining templates as additional templates', done => {
      sinon.stub(helpers, 'readDirectory').callsFake(() => {
        return Promise.resolve(directoryListing)
      })

      const mockReadFile = sinon
        .stub(fs, 'readFile')
        .yields(null, 'File contents')

      sinon.stub(fs, 'statSync').callsFake(() => ({
        isFile: () => true
      }))

      templateStore.loadEngines([require('web-es6-templates')])

      templateStore.loadPages(pages, {}).then(response => {
        pages.forEach((page, index) => {
          mockReadFile.getCall(index).args[0].should.eql(page.file)
        })

        const expectedTemplatesLoaded = pages.map(page => {
          const extension = path.extname(page.file)

          return path
            .relative(config.get('paths.pages'), page.file)
            .replace(extension, '')
        })

        fs.statSync.restore()
        fs.readFile.restore()

        response.should.deepEqual(expectedTemplatesLoaded)

        templateStore.additionalTemplates.should.deepEqual(additionalFiles)

        done()
      })
    })
  })
})
