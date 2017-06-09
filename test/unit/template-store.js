"use strict"

const path = require("path")
const sinon = require("sinon")
const should = require("should")

const api = require(__dirname + "/../../dadi/lib/api")
const Server = require(__dirname + "/../help").Server
const TemplateStore = require(__dirname + "/../../dadi/lib/templates/store")
  .TemplateStore
const TestHelper = require(__dirname + "/../help")()

let config
let templateStore

describe.only("Template store", function(done) {
  beforeEach(done => {
    TestHelper.resetConfig().then(newConfig => {
      config = newConfig

      templateStore = new TemplateStore()

      done()
    })
  })

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
})
