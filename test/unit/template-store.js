"use strict"

const fs = require("fs")
const path = require("path")
const sinon = require("sinon")
const should = require("should")

const helpers = require(__dirname + "/../../dadi/lib/help")
const TemplateStore = require(__dirname + "/../../dadi/lib/templates/store")
  .TemplateStore
const testHelpers = require(__dirname + "/../help")()

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
      path.resolve(config.get("paths.pages"), "page1.dust"),
      path.resolve(config.get("paths.pages"), "page2.dust"),
      path.resolve(config.get("paths.pages"), "sub-dir-1/page3.dust"),
      path.resolve(config.get("paths.pages"), "partials/partial1.dust")
    ]

    pages = [
      {
        engine: "dust",
        file: directoryListing[0]
      },
      {
        engine: "dust",
        file: directoryListing[1]
      },
      {
        engine: "dust",
        file: directoryListing[2]
      }
    ]

    additionalFiles = [directoryListing[3]]

    done()
  })
})

describe("Template store", function(done) {
  describe("Validation", function(done) {
    it("throw if engine is missing a metadata block", done => {
      const fakeFactory = {}

      try {
        new TemplateStore().validateEngine(fakeFactory, {})
      } catch (err) {
        err.message.indexOf("is missing the metadata block").should.not.eql(-1)

        done()
      }
    })

    it("throw if engine is missing a valid extensions array", done => {
      const fakeFactory = {
        metadata: {
          extensions: ".dust"
        }
      }

      try {
        new TemplateStore().validateEngine(fakeFactory, {})
      } catch (err) {
        err.message
          .indexOf(
            "is missing a valid extensions property on the metadata block"
          )
          .should.not.eql(-1)

        done()
      }
    })

    it("throw if engine is missing a valid handle property", done => {
      const fakeFactory1 = {
        metadata: {
          extensions: [".dust"]
        }
      }
      const fakeFactory2 = {
        metadata: {
          extensions: [".dust"],
          handle: 12345
        }
      }

      let err1, err2

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
        .indexOf("is missing a valid handle property on the metadata block")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing a valid handle property on the metadata block")
        .should.not.eql(-1)

      done()
    })

    it("throw if engine is missing a `getCore()` method", done => {
      const fakeFactory = {
        metadata: {
          extensions: [".dust"],
          handle: "dust"
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        getCore: "notAFunction"
      }

      let err1, err2

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
        .indexOf("is missing the `getCore()` method")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing the `getCore()` method")
        .should.not.eql(-1)

      done()
    })

    it("throw if engine is missing a `getInfo()` method", done => {
      const fakeFactory = {
        metadata: {
          extensions: [".dust"],
          handle: "dust"
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        getInfo: "notAFunction"
      }

      let err1, err2

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
        .indexOf("is missing the `getInfo()` method")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing the `getInfo()` method")
        .should.not.eql(-1)

      done()
    })

    it("throw if engine is missing a `initialise()` method", done => {
      const fakeFactory = {
        metadata: {
          extensions: [".dust"],
          handle: "dust"
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        initialise: "notAFunction"
      }

      let err1, err2

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
        .indexOf("is missing the `initialise()` method")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing the `initialise()` method")
        .should.not.eql(-1)

      done()
    })

    it("throw if engine is missing a `register()` method", done => {
      const fakeFactory = {
        metadata: {
          extensions: [".dust"],
          handle: "dust"
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        register: "notAFunction"
      }

      let err1, err2

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
        .indexOf("is missing the `register()` method")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing the `register()` method")
        .should.not.eql(-1)

      done()
    })

    it("throw if engine is missing a `render()` method", done => {
      const fakeFactory = {
        metadata: {
          extensions: [".dust"],
          handle: "dust"
        }
      }
      const fakeEngine1 = {}
      const fakeEngine2 = {
        render: "notAFunction"
      }

      let err1, err2

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
        .indexOf("is missing the `render()` method")
        .should.not.eql(-1)
      err2.message
        .indexOf("is missing the `render()` method")
        .should.not.eql(-1)

      done()
    })
  })

  describe("loadEngine", () => {
    it("should load template engines", done => {
      templateStore.loadEngines([require("@dadi/web-dustjs")])

      templateStore.engines.dust.should.be.Object
      templateStore.engines.dust.factory.should.be.Function
      templateStore.engines.dust.started.should.eql(false)

      done()
    })

    it("should load engine config block onto global config", done => {
      templateStore.loadEngines([require("@dadi/web-dustjs")])

      const engine = templateStore.engines.dust
      const engineConfig = config.get("engines.dust")

      engineConfig.should.be.Object

      Object.keys(engine.factory.metadata.config).forEach(property => {
        should.exist(engineConfig[property])
      })

      done()
    })
  })

  describe("loadTemplate", () => {
    it("should start an engine when a template that requires it is loaded", done => {
      templateStore.loadEngines([require("@dadi/web-dustjs")])

      templateStore
        .loadTemplate({
          data: "",
          extension: ".dust",
          name: "fakeTemplate1",
          namespace: undefined,
          path: "/fake/path/fakeTemplate1.dust"
        })
        .then(loadedTemplate => {
          templateStore.engines.dust.started.should.eql(true)

          done()
        })
    })

    it("should throw an error when loading a template with an extension that is not supported", () => {
      templateStore.loadEngines([require("@dadi/web-dustjs")])

      should.throws(() => {
        templateStore.loadTemplate({
          data: "",
          extension: ".foo",
          name: "fakeTemplate2",
          namespace: undefined,
          path: "/fake/path/fakeTemplate2.foo"
        })
      })
    })

    it("should instantiate the engine and call its `initialise` and `register` methods", done => {
      var mockInitialiseFn = sinon.stub()
      var mockRegisterFn = sinon.stub()

      var fakeEngine = () => {
        var Engine = function() {}

        Engine.prototype.initialise = mockInitialiseFn
        Engine.prototype.getCore = function() {}
        Engine.prototype.getInfo = function() {}
        Engine.prototype.register = mockRegisterFn
        Engine.prototype.render = function() {}

        return Engine
      }

      fakeEngine.metadata = {
        extensions: [".dust"],
        handle: "dust"
      }

      var templateData = {
        data: "This is the content of the template",
        extension: ".dust",
        name: "fakeTemplate1",
        namespace: undefined,
        path: "/fake/path/fakeTemplate1.dust"
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
          console.log("** ERR:", err)
        })
    })
  })

  describe("loadPages", () => {
    it("should all templates corresponding to the given pages, setting any remaining templates as additional templates", done => {
      sinon.stub(helpers, "readDirectory").callsFake(() => {
        return Promise.resolve(directoryListing)
      })

      var mockReadFile = sinon
        .stub(fs, "readFile")
        .yields(null, "File contents")
      sinon.stub(fs, "statSync").callsFake(() => ({
        isFile: () => true
      }))

      templateStore.loadEngines([require("@dadi/web-dustjs")])

      templateStore.loadPages(pages, {}).then(response => {
        pages.forEach((page, index) => {
          mockReadFile.getCall(index).args[0].should.eql(page.file)
        })

        var expectedTemplatesLoaded = pages.map(page => {
          var extension = path.extname(page.file)

          return path
            .relative(config.get("paths.pages"), page.file)
            .replace(extension, "")
        })

        response.should.deepEqual(expectedTemplatesLoaded)

        templateStore.additionalTemplates.should.deepEqual(additionalFiles)

        done()
      })
    })
  })
})
