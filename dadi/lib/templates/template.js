/**
 * Builds a new template instance.
 *
 * @param {string} name The name of the template.
 * @param {string} namespace The namespace of the template.
 * @param {object} engine The templating engine.
 */
const Template = function (name, namespace, path, engine) {
  this.name = (namespace || '') + name
  this.engine = engine
  this.path = path
}

/**
 * Executes `getInfo()` on the template engine.
 *
 * @return {object} The result of the `getInfo()` call.
 */
Template.prototype.getEngineInfo = function () {
  return this.engine.handler.getInfo()
}

/**
 * Executes `render()` on the template engine.
 *
 * @param {object} locals Template variables.
 * @param {object} options Additional render options.
 * @param {boolean} options.keepWhitespace Whether to preserve whitespace.
 *
 * @return {object} The rendered markup.
 */
Template.prototype.render = function (locals, options) {
  return this.engine.handler.render(this.name, this.data, locals, options)
}

/**
 * Executes `register()` on the template engine.
 *
 * @param {object} data The template data/content.
 *
 * @return {Promise} A Promise that resolves when data has been added to the template.
 */
Template.prototype.register = function (data) {
  this.data = data

  return Promise.resolve(
    this.engine.handler.register(this.name, data, this.path)
  )
}

module.exports = Template
