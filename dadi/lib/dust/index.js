var config = require(__dirname + '/../../../config.js');
var dust = require('dustjs-linkedin');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var Dust = function () {
  this.templates = {};

	dust.onLoad = (function (templateName, opts, callback) {
    var template = templateName + '.dust';

    if (template.indexOf('partials') > -1) {
      template = this.options.partialPath + '/' + template.replace('partials/', '');
    } else {
      template = this.options.pagePath + '/' + template;
    }

    fs.readFile(template, { encoding: 'utf8' }, function (err, data) {
      if (err) {
        // no template file found?
        return callback(err, null);
      }

      return callback(null, data);
    });
  }).bind(this);
};

Dust.prototype._buildHelpersFile = function () {
  var helpersFile = '';

  Object.keys(dust.helpers).forEach(function (helper) {
    helpersFile += ('dust.helpers.' + helper + '=' + dust.helpers[helper].toString() + ';');
  });

  return helpersFile;
};

Dust.prototype._requireDirectory = function (directory) {
  return new Promise(function (resolve, reject) {
    fs.stat(directory, function (err, stats) {
      if (err) {
        reject(err);
      }

      if (stats.isDirectory()) {
        fs.readdir(directory, function (err, files) {
          if (err) {
            reject(err);
          }

          var filesToRead = files.length;

          if (filesToRead === 0) {
            return resolve();
          }

          files.forEach(function (file) {
            var filepath = path.resolve(directory, file);

            fs.stat(filepath, function (err, stats) {
              filesToRead--;

              if (err) {
                reject(err);
              }

              if (stats.isFile() && (path.extname(filepath) === '.js')) {
                require(filepath);
              }

              if (filesToRead === 0) {
                resolve();      
              }
            });
          });
        });
      }
    });
  });
};

Dust.prototype.clearCache = function () {
  dust.cache = {};
};

Dust.prototype.compile = function (source, templateName, load) {
  load = (load !== false);

  var compiled = dust.compile(source, templateName);

  if (load) {
    dust.loadSource(compiled);
  }

  this.templates[templateName] = compiled;

  return compiled;
};

Dust.prototype.getEngine = function () {
  return dust;
};

Dust.prototype.isLoaded = function (templateName) {
  return dust.cache.hasOwnProperty(templateName);
};

Dust.prototype.loadFilters = function () {
  return this._requireDirectory(this.options.filtersPath);
};

Dust.prototype.loadHelpers = function () {
  // Loading core Dust helpers
  require('dustjs-helpers');

  return this._requireDirectory(this.options.helpersPath);
};

Dust.prototype.render = function (templateName, data, callback) {
  dust.render(templateName, data, callback);
};

Dust.prototype.setConfig = function (key, value) {
  dust.config[key] = value;
};

Dust.prototype.setDebug = function (debug) {
  dust.isDebug = debug;
};

Dust.prototype.setDebugLevel = function (debugLevel) {
  dust.debugLevel = debugLevel;
};

Dust.prototype.setOptions = function (options) {
  this.options = options;
};

Dust.prototype.writeClientsideTemplates = function () {
  var compiledTemplates = this.templates;

  if (config.get('dust.clientRender.enabled')) {
    if (config.get('dust.clientRender.helpersOutputPath') !== '') {
      var helpersOutputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.helpersOutputPath'));
      var helpersOutput = this._buildHelpersFile();
      
      mkdirp(path.dirname(helpersOutputFile), function (err, made) {
        if (err) {
          log.error({module: 'dust'}, {err: err}, 'Error creating directory for helpers');

          return;
        }

        fs.writeFile(helpersOutputFile, helpersOutput, function (err) {
          if (err) {
            log.error({module: 'dust'}, {err: err}, "Error writing helpers to file '%s'", helpersOutputFile);

            return;
          }
        });
      });
    }

    if (config.get('dust.clientRender.outputFormat') === 'combined') {
      var outputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.outputPath'));
      var templatesOutput = '';

      Object.keys(compiledTemplates).forEach(function (name) {
        templatesOutput += compiledTemplates[name];
      });

      mkdirp(path.dirname(outputFile), {}, function (err, made) {
        if (err) {
          log.error({module: 'dust'}, {err: err}, 'Error creating directory for compiled template');

          return;
        }

        fs.writeFile(outputFile, templatesOutput, function (err) {
          if (err) {
            log.error({module: 'dust'}, {err: err}, "Error writing compiled template to file '%s'", outputFile);
          }
        });
      });
    } else {
      Object.keys(compiledTemplates).forEach(function (name) {
        var outputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.outputPath'), name) + '.js';

        mkdirp(path.dirname(outputFile), {}, function (err, made) {
          if (err) {
            log.error({module: 'dust'}, {err: err}, 'Error creating directory for compiled template');

            return;
          }

          fs.writeFile(outputFile, compiledTemplates[name], function (err) {
            if (err) {
              log.error({module: 'dust'}, {err: err}, "Error writing compiled template to file '%s'", outputFile);
            }
          });
        });
      });
    }
  }
};

module.exports = new Dust();
