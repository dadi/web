const _ = require('underscore')
const debug = require('debug')('web:templates')
const fs = require('fs')
const log = require('@dadi/logger')
const path = require('path')

const config = require(path.join(__dirname, '/../../../config.js'))
const helpers = require(path.resolve(__dirname, 'helpers'))
const Template = require(path.resolve(__dirname, 'template'))

/**
  * Builds a template store.
  */
const TemplateStore = function () {
  this.engines = {}
  this.templates = {}
}

/**
  * Triggers the `finishLoading` function on all templating engines.
  *
  * @return {Promise} Resolves when all functions finish executing.
  */
TemplateStore.prototype.finishLoading = function () {
  let queue = []

  Object.keys(this.engines).forEach(name => {
    const engine = this.engines[name]
    const finishLoadingFunction = engine.handler.finishLoading

    if (typeof finishLoadingFunction === 'function') {
      queue.push(finishLoadingFunction.call(engine.handler))
    }
  })

  return Promise.all(queue)
}

/**
  * Retrieves a template by name.
  *
  * @param {string} templateName The name of the template.
  *
  * @return {Template} The template.
  */
TemplateStore.prototype.get = function (templateName) {
  return this.templates[templateName]
}

/**
  * Loads all files in a directory.
  *
  * @param {string} directory The full path to the directory.
  * @param {object} options Additional options.
  * @param {boolean} options.recursive Whether to load files in sub-directories.
  * @param {string} options.namespace A namespace for the files.
  *
  * @return {Promise} A Promise resolving when all files have been loaded.
  */
TemplateStore.prototype.loadDirectory = function (directory, options) {
  options = options || {}
  options.recursive = options.recursive || false
  options.extensions = Object.keys(this.engines)

  return helpers.readDirectory(directory, options).then(files => {
    return this.loadFiles(
      files,
      _.extend(
        {
          basePath: directory
        },
        options
      )
    )
  })
}

/**
  * Loads all templating engines.
  */
TemplateStore.prototype.loadEngines = function () {
  const directory = path.resolve(__dirname, 'engines')

  return this.loadEnginesFromDirectory(directory).then(engines => {
    debug('Loaded templating engines: %o', engines)
  })
}

/**
  * Loads templating engines from a given directory.
  *
  * @param {string} directory The full path to the directory.
  */
TemplateStore.prototype.loadEnginesFromDirectory = function (directory) {
  return helpers
    .readDirectory(directory, {
      extensions: ['.js']
    })
    .then(engines => {
      engines.forEach(engine => {
        try {
          const extension = require(engine).extension

          if (
            typeof extension === 'string' &&
            typeof this.engines[extension] === 'undefined'
          ) {
            this.engines[extension] = {
              factory: require(engine),
              started: false
            }
          }
        } catch (err) {
          log.error(
            { module: 'templates' },
            { err: err },
            `Error initialising templating engine "${engine}".`
          )
        }
      })

      return engines.map(engine => path.basename(engine, '.js'))
    })
}

/**
  * Loads files from an array of paths.
  *
  * @param {array} files The absolute paths for the files to be loaded.
  * @param {object} options Additional options.
  * @param {string} options.basePath When present, makes the name relative to this directory.
  * @param {boolean} options.recursive Whether to load files in sub-directories.
  * @param {string} options.namespace A namespace for the files.
  *
  * @return {Promise} A Promise resolving when all files have been loaded.
  */
TemplateStore.prototype.loadFiles = function (files, options) {
  options = options || {}

  return helpers.readFiles(files, {
    callback: file => {
      const extension = path.extname(file)
      const templateName = options.basePath
        ? path.relative(options.basePath, file).slice(0, -extension.length)
        : path.basename(file, extension)

      return new Promise((resolve, reject) => {
        fs.readFile(file, 'utf8', (err, data) => {
          if (err) return reject(err)

          return resolve(
            this.loadTemplate({
              data: data,
              extension: extension,
              name: templateName,
              namespace: options.namespace
            })
          )
        })
      })
    },

    extensions: Object.keys(this.engines)
  })
}

/**
  * Loads a template into the store.
  *
  * @param {object} parameters The template parameters.
  * @param {string} parameters.data The content of the template.
  * @param {string} parameters.extension The file extension.
  * @param {string} parameters.name The name of the template.
  * @param {string} parameters.namespace The namespace of the template.
  */
TemplateStore.prototype.loadTemplate = function (parameters) {
  parameters = parameters || {}

  const engine = this.engines[parameters.extension]
  const name = parameters.name
  const namespace = parameters.namespace || ''

  if (this.templates[name + namespace]) {
    return Promise.resolve(false)
  }

  if (!engine) {
    log.error(
      { module: 'templates' },
      {
        err: new Error(
          `Error loading template "${parameters.name}": no engine for extension ${parameters.extension}.`
        )
      }
    )

    return
  }

  let startQueue = []

  // If this engine hasn't been started yet, we start it now.
  if (!engine.started) {
    const EngineConstructor = engine.factory()

    engine.handler = new EngineConstructor({
      config: config,
      helpers: helpers,
      partialsDirectories: this.partialsDirectories
    })

    this.validateEngine(engine.factory, engine.handler)

    engine.started = true

    // Converting the `initialise` function to a Promise, to allow engines to
    // perform asynchronous initialisation routines.
    const initialise = Promise.resolve(engine.handler.initialise())

    startQueue.push(initialise)
  }

  return Promise.all(startQueue).then(() => {
    const template = new Template(parameters.name, parameters.namespace, engine)

    this.templates[namespace + name] = template

    return template.setData(parameters.data).then(data => {
      return name
    })
  })
}

/**
  * Sets the partials directories.
  *
  * @param {array} directories A list of full paths.
  */
TemplateStore.prototype.setPartialsDirectories = function (directories) {
  this.partialsDirectories = directories
}

/**
  * Validates a templating engine, checking for vital lifecycle methods.
  *
  * @throws {Error} If the engine fails the validation.
  */
TemplateStore.prototype.validateEngine = function (factory, engine) {
  let errors = []

  if (typeof factory.extension !== 'string') {
    errors.push('is missing the extension export')
  }

  if (typeof factory.name !== 'string') {
    errors.push('is missing the name export')
  }

  if (typeof engine.getCore !== 'function') {
    errors.push('is missing the `getCore()` method')
  }

  if (typeof engine.getInfo !== 'function') {
    errors.push('is missing the `getInfo()` method')
  }

  if (typeof engine.initialise !== 'function') {
    errors.push('is missing the `initialise()` method')
  }

  if (typeof engine.render !== 'function') {
    errors.push('is missing the `render()` method')
  }

  if (typeof engine.setData !== 'function') {
    errors.push('is missing the `setData()` method')
  }

  if (errors.length) {
    const errorMessage = `Validation failed for "${factory && factory.name}" templating engine: ${errors.join(', ')}`
    const error = new Error(errorMessage)

    log.error({ module: 'templates' }, { err: error }, errorMessage)

    throw error
  }
}

module.exports = (() => new TemplateStore())()
