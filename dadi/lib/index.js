
var version = require('../../package.json').version;
var site = require('../../package.json').name;
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

var _ = require('underscore');
var bodyParser = require('body-parser');
var colors = require('colors');
var compress = require('compression');
var crypto = require('crypto');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var enableDestroy = require('server-destroy');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var raven = require('raven');
var serveFavicon = require('serve-favicon');
var serveStatic = require('serve-static');
var session = require('express-session');
var toobusy = require('toobusy-js');
var url = require('url');
var dadiStatus = require('@dadi/status');

var mongoStore;
if (nodeVersion < 1) {
  mongoStore = require('connect-mongo/es5')(session);
}
else {
  mongoStore = require('connect-mongo')(session);
}
var RedisStore = require('connect-redis')(session);


// let's ensure there's at least a dev config file here
var devConfigPath = __dirname + '/../../config/config.development.json';
try {
  var stats = fs.statSync(devConfigPath);
}
catch(err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync(devConfigPath, fs.readFileSync(devConfigPath+'.sample'));
  }
}

var controller = require(__dirname + '/controller');
var forceDomain = require(__dirname + '/controller/forceDomain');
var router = require(__dirname + '/controller/router');
var Page = require(__dirname + '/page');
var middleware = require(__dirname + '/middleware');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var log = require(__dirname + '/log');
var help = require(__dirname + '/help');
var dustHelpersExtension = require(__dirname + '/dust/helpers.js');
var datasource = require(__dirname + '/datasource');

var config = require(path.resolve(__dirname + '/../../config.js'));

/**
 * Creates a new Server instance.
 * @constructor
 */
var Server = function () {
    this.components = {};
    this.monitors = {};

    log.info({module: 'server'}, 'Server logging started.');
};

Server.prototype.start = function (done) {
    var self = this;

    this.readyState = 2;

    var options = this.loadPaths(config.get('paths') || {});

    // create app
    var app = this.app = api();

    // override config
    if (options.configPath) {
      config.loadFile(options.configPath);
    }

    if (config.get('logging.sentry.dsn') !== "") {
      app.use(raven.middleware.express.requestHandler(config.get('logging.sentry.dsn')));
    }

    if (config.get('rewrites.forceDomain') !== "") {
      app.use(forceDomain({
        hostname: config.get('rewrites.forceDomain'),
        port: 80
      }));
    }

    // serve static files (css,js,fonts)
    if (options.mediaPath) app.use(serveStatic(options.mediaPath, { 'index': false }));

    if (options.publicPath) {
      app.use(serveStatic(options.publicPath, { 'index': false, maxAge: '1d', setHeaders: setCustomCacheControl }));
      try {
        app.use(serveFavicon((options.publicPath || __dirname + '/../../public') + '/favicon.ico'));
      }
      catch (err) {
        // file not found
      }
    }

    // add debug files to static paths
    if (config.get('debug')) {
      app.use(serveStatic(options.workspacePath + '/debug' || (__dirname + '/../../workspace/debug') , { 'index': false }));
    }

    // add parsers
    app.use(bodyParser.json());
    app.use(bodyParser.text());
    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: true }));

    // request logging middleware
    app.use(log.requestLogger);

    // add gzip compression
    if (config.get('headers.useGzipCompression')) {
      app.use(compress());
    }

    // update configuration based on domain
    var domainConfigLoaded;
    app.use(function(req, res, next) {
      if (domainConfigLoaded) return next();
      config.updateConfigDataForDomain(req.headers.host);
      domainConfigLoaded = true;
      return next();
    });

    // session manager
    var sessionConfig = config.get('sessions');

    if (sessionConfig.enabled) {
      var sessionOptions = {
        name: sessionConfig.name,
        secret: sessionConfig.secret,
        resave: sessionConfig.resave,
        saveUninitialized: sessionConfig.saveUninitialized,
        cookie: sessionConfig.cookie
      };

      var store = this.getSessionStore(sessionConfig);

      if (store) {
        sessionOptions.store = store;
      }

      // add the session middleware
      app.use(session(sessionOptions));
    }

    app.use('/config', function(req, res, next) {
      var hash = crypto.createHash('md5').update(config.get('secret')+config.get('app.name')).digest('hex');
      console.log(hash)
      if (url.parse(req.url,true).query.secret === hash) {
        res.statusCode = 200;
        //res.end(config.toString());
        res.end(config.getSchemaString());
      }
      else {
        next();
      }
    });

    // handle routing & redirects
    router(self, options);

    if (config.get('api.enabled')) {
      // authentication layer
      auth(self);

      // caching layer
      cache(self).init();
    }

    // start listening
    var server = this.server = app.listen(config.get('server.port'), config.get('server.host'));

    server.on('connection', onConnection);
    server.on('listening', onListening);

    if (config.get('env') !== 'test') {
      server.on('error', onError);
    }

    // enhance with a 'destroy' function
    enableDestroy(server);

    // load app specific routes
    this.loadApi(options);

    var virtualDirs = config.get('virtualDirectories');
    _.each(virtualDirs, function (dir) {
      app.use(serveStatic(__dirname + '/../../' + dir.path , { 'index': dir.index, 'redirect': dir.forceTrailingSlash }));
    });

    // dust configuration
    dust.isDebug = config.get('dust.debug');
    dust.debugLevel = config.get('dust.debugLevel');
    dust.config.cache = config.get('dust.cache');
    dust.config.whitespace = config.get('dust.whitespace');

    this.readyState = 1;

    if (config.get('env') !== 'test') {
      //do something when app is closing
      process.on('exit', this.exitHandler.bind(null, {server: this, cleanup: true}));

      //catches ctrl+c event
      process.on('SIGINT', this.exitHandler.bind(null, {server: this, exit: true}));

      //catches uncaught exceptions
      process.on('uncaughtException', this.exitHandler.bind(null, {server: this, exit: true}));
    }

    // this is all sync, so callback isn't really necessary.
    done && done();
}

Server.prototype.exitHandler = function(options, err) {
  var server = options.server;

  if (options.cleanup) {
    server.stop(function() {
      toobusy.shutdown();
    });
  }

  if (err) {
    console.log(err.stack.toString());
  }

  if (options.exit) {
    console.log();
    console.log('Server stopped, process exiting...');
    log.info({module: 'server'}, 'Server stopped, process exiting.');
    process.exit();
  }
}

function setCustomCacheControl(res, path) {
  _.each(config.get('headers.cacheControl'), function (value, key) {
    if (serveStatic.mime.lookup(path) === key && value !== '') {
      res.setHeader('Cache-Control', value);
    }
  });
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
    var self = this;
    this.readyState = 3;

    Object.keys(this.monitors).forEach(this.removeMonitor.bind(this));

    Object.keys(this.components).forEach(this.removeComponent.bind(this));

    this.server.destroy();

    this.server.close(function (err) {
      self.readyState = 0;
      return done && done(err);
    });
};

Server.prototype.loadPaths = function(paths) {

  var self = this;
  var options = {};

  options.datasourcePath = path.resolve(paths.datasources || __dirname + '/../../app/datasources');
  options.eventPath = path.resolve(paths.events || __dirname + '/../../app/events');
  options.pagePath = path.resolve(paths.pages || __dirname + '/../../app/pages');
  options.partialPath = path.resolve(paths.partials || __dirname + '/../../app/partials');
  options.routesPath = path.resolve(paths.routes || __dirname + '/../../app/routes');
  options.middlewarePath = path.resolve(paths.middleware || __dirname + '/../../app/middleware');

  options.filtersPath = path.resolve(paths.filters || __dirname + '/../../app/utils/filters');
  options.helpersPath = path.resolve(paths.helpers || __dirname + '/../../app/utils/helpers');

  options.tokenWalletsPath = path.resolve(paths.tokenWallets || __dirname + '/../../.wallet');

  if (paths.media) options.mediaPath = path.resolve(paths.media);
  if (paths.public) options.publicPath = path.resolve(paths.public);

  _.each(options, function(path, key) {
    fs.stat(path, function(err, stats) {
      if (err) {
        if (err.code === 'ENOENT') {

          self.ensureDirectories(options, function() {
            //
          });

        }
      }
    });
  });

  return options;
}

Server.prototype.loadApi = function (options) {

  var self = this;

  this.app.use('/api/flush', function (req, res, next) {
    if (help.validateRequestMethod(req, res, 'POST') && help.validateRequestCredentials(req, res)) {
      return help.clearCache(req, function (err) {
        help.sendBackJSON(200, res, next)(err, {
          result: 'success',
          message: 'Succeed to clear'
        });
      });

      next();
    }
  });

  this.app.use('/api/status', function(req, res, next) {
    if (help.validateRequestMethod(req, res, 'POST') && help.validateRequestCredentials(req, res)) {
      var params = {
        site: site,
        package: '@dadi/web',
        version: version,
        healthCheck: {
          baseUrl: 'http://' + config.get('server.host') + ':' + config.get('server.port'),
          routes: config.get('status.routes')
        }
      }

      dadiStatus(params, function(err, data) {
        if (err) return next(err);
        var resBody = JSON.stringify(data, null, 2);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('content-length', Buffer.byteLength(resBody));
        res.end(resBody);
      });
    }
  });


  self.ensureDirectories(options, function(text) {

    // load routes
    self.updatePages(options.pagePath, options, false);

    // Load middleware
    self.initMiddleware(options.middlewarePath, options);

    // compile all dust templates
    self.dustCompile(options);

    self.addMonitor(options.datasourcePath, function (dsFile) {
        self.updatePages(options.pagePath, options, true);
    });

    self.addMonitor(options.eventPath, function (eventFile) {
        self.updatePages(options.pagePath, options, true);
    });

    self.addMonitor(options.pagePath, function (pageFile) {
        self.updatePages(options.pagePath, options, true);
        self.dustCompile(options);
    });

    self.addMonitor(options.partialPath, function (partialFile) {
        self.dustCompile(options);
    });

    self.addMonitor(options.routesPath, function (file) {
      if (self.app.Router) {
        self.app.Router.loadRewrites(options, function() {
          self.app.Router.loadRewriteModule();
        });
      }
    });

    log.info({module: 'server'}, 'Load complete.');

  });

};

Server.prototype.initMiddleware = function (directoryPath, options) {
  var middlewares = this.loadMiddleware(directoryPath, options);
  _.each(middlewares, function(middleware) {
    middleware.init(this.app);
  }, this);
};

Server.prototype.loadMiddleware = function (directoryPath, options) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var files = fs.readdirSync(directoryPath);

    var middlewares = [];

    files.forEach(function (file) {
        if (path.extname(file) !== '.js') return;

        var filepath = path.join(directoryPath, file);
        var name = file.slice(0, file.indexOf('.'));
        var m = new middleware(name, options);
        middlewares.push(m);
    });

    return middlewares;
};

Server.prototype.updatePages = function (directoryPath, options, reload) {

    if (!fs.existsSync(directoryPath)) return;

    var self = this;
    var pages = fs.readdirSync(directoryPath);

    pages.forEach(function (page) {
      if (path.extname(page) !== '.json') return;

      // get the full path to the page file
      var pageFilepath = path.join(directoryPath, page);

      // strip the filename minus the extension
      // to use as the page name
      var name = page.slice(0, page.indexOf('.'));

      self.addRoute({
        name: name,
        filepath: pageFilepath
      }, options, reload);

    });
};

Server.prototype.addRoute = function (obj, options, reload) {

    // get the page schema
    var schema;

    try {
      schema = require(obj.filepath);
    }
    catch (err) {
      log.error({module: 'server'}, {err: err}, 'Error loading page schema "' + obj.filepath + '". Is it valid JSON?');
      throw err;
    }

    // create a page with the supplied schema,
    // using the filename as the page name
    var page = Page(obj.name, schema);

    // create a handler for requests to this page
    var control = controller(page, options, schema.page);

    // add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    this.addComponent({
        key: page.key,
        route: page.route,
        component: control,
        filepath: obj.filepath
    }, reload);
};

Server.prototype.addComponent = function (options, reload) {

    if (!options.route) return;

    if (reload) {
        _.each(options.route.paths, function (path) {
            this.removeComponent(path);
        }, this);
    }

    var self = this;

    _.each(options.route.paths, function (path) {

        // only add a route once
        if (this.components[path]) return;

        this.components[path] = options.component;

        if (path === '/index') {

            log.debug({module: 'server'}, "Loaded " + path);

            // configure "index" route
            this.app.use('/', function (req, res, next) {
                // map request method to controller method
                var method = req.method && req.method.toLowerCase();

                if (method && options.component[method]) {

                    return options.component[method](req, res, next);
                }
                next();
            });
        }
        else {

            log.debug({module: 'server'}, "Loaded " + path);

            if (options.route.constraint) this.app.Router.constrain(path, options.route.constraint);

            var self = this;

            this.app.use(path, function (req, res, next) {

                self.app.Router.testConstraint(path, req, res, function (result) {

                    // test returned false, try the next matching route
                    if (!result) return next();

                    // map request method to controller method
                    var method = req.method && req.method.toLowerCase();

                    // if it's a HEAD request, fake it as a GET so that it
                    // continues. The help.sendbackHTML method will be passed
                    // the actual req.method to determine what we send back
                    if (method === 'head') method = 'get';

                    if (method && options.component[method]) {
                      return options.component[method](req, res, next);
                    }

                    // no matching HTTP method found, try the next matching route
                    if (next) {
                      return next();
                    }
                    else {
                      return help.sendBackJSON(404, res, next)(null, require(options.filepath));
                    }
                });
            });
        }
    }, this);
};

Server.prototype.removeComponent = function (route) {
    this.app.unuse(route);
    delete this.components[route];
};

Server.prototype.getComponent = function (key) {
  return _.find(this.components, function (component) {
    return component.page.key === key;
  });
};

Server.prototype.addMonitor = function (filepath, callback) {
    filepath = path.normalize(filepath);

    // only add one watcher per path
    if (this.monitors[filepath]) return;

    var m = monitor(filepath);
    m.on('change', callback);

    this.monitors[filepath] = m;
};

Server.prototype.removeMonitor = function (filepath) {
    this.monitors[filepath] && this.monitors[filepath].close();
    delete this.monitors[filepath];
};

Server.prototype.dustCompile = function (options) {

    var pagePath = options.pagePath;
    var templatePath = options.pagePath;
    var partialPath = options.partialPath;

    var self = this;

    // reset the dust cache so
    // templates can be reloaded
    dust.cache = {};

    var compiledTemplates = {};

    _.each(self.components, function(component) {
        try {
            var filepath = path.join(templatePath, component.page.template);
            var template =  fs.readFileSync(filepath, "utf8");
            var name = component.page.template.slice(0, component.page.template.indexOf('.'));
            var compiled = dust.compile(template, name, true);

            compiledTemplates[name] = compiled;

            dust.loadSource(compiled);
        }
        catch (e) {
            var message = '\nCouldn\'t compile Dust template at "' + filepath + '". ' + e + '\n';
            console.log(message);
            throw e;
        }
    });

    // load templates in the template folder that haven't already been loaded
    var templates = fs.readdirSync(templatePath);
    templates.map(function (file) {
        return path.join(templatePath, file);
    }).filter(function (file) {
        return path.extname(file) === '.dust';
    }).forEach(function (file) {

        var pageTemplateName = path.basename(file, '.dust');

        if (!_.find(_.keys(dust.cache), function (k) { return k.indexOf(pageTemplateName) > -1; })) {
            console.log('--> COMPILING HERE!');
            log.info({module: 'server'}, "Template not found in cache, loading '%s' (%s)", pageTemplateName, file);

            var template =  fs.readFileSync(file, "utf8");

            try {
                var compiled = dust.compile(template, pageTemplateName, true);

                compiledTemplates[pageTemplateName] = compiled;

                dust.loadSource(compiled);
            }
            catch (e) {
                var message = '\nCouldn\'t compile Dust template "' + pageTemplateName + '". ' + e + '\n';
                console.log(message);
                throw e;
            }
        }
    });

    var loadPartialsDirectory = function (directory) {
      directory = directory || '';

      var directoryList = fs.readdirSync(path.join(partialPath, directory));

      directoryList.forEach(function (itemPath) {
        var item = fs.statSync(path.join(partialPath, directory, itemPath));

        if (item.isDirectory()) {
          loadPartialsDirectory(directory + itemPath + '/');
        } else {
          // Load the template from file
          var name = itemPath.slice(0, itemPath.lastIndexOf('.'));
          var template = fs.readFileSync(path.join(partialPath, directory, itemPath), 'utf8');

          try {
              var partialName = 'partials/' + directory + name;
              var compiled = dust.compile(template, partialName, true);
              
              if (config.get('dust.clientRender.enabled')) {
                compiledTemplates[partialName] = compiled;
              }

              dust.loadSource(compiled);
          }
          catch (e) {
              var message = '\nCouldn\'t compile Dust partial at "' + path.join(partialPath, directory, itemPath) + '". ' + e + '\n';
              console.log(message);
              throw e;
          }
        }
      });
    };

    loadPartialsDirectory();

    // Writing compiled partials
    if (config.get('dust.clientRender.enabled')) {
      if (config.get('dust.clientRender.outputFormat') === 'combined') {
        var outputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.outputPath'));
        var clientRenderOutput = '';

        Object.keys(compiledTemplates).forEach(function (name) {
          clientRenderOutput += compiledTemplates[name];
        });

        mkdirp(path.dirname(outputFile), {}, function (err, made) {
          if (err) {
            log.error({module: 'server'}, {err: err}, 'Error creating directory for compiled template');

            return;
          }

          fs.writeFile(outputFile, clientRenderOutput, function (err) {
            if (err) {
              log.error({module: 'server'}, {err: err}, "Error writing compiled template to file '%s'", outputFile);
            }
          });
        });
      } else {
        Object.keys(compiledTemplates).forEach(function (name) {
          var outputFile = path.join(config.get('paths.public'), config.get('dust.clientRender.outputPath'), name) + '.js';

          mkdirp(path.dirname(outputFile), {}, function (err, made) {
            if (err) {
              log.error({module: 'server'}, {err: err}, 'Error creating directory for compiled template');

              return;
            }

            fs.writeFile(outputFile, compiledTemplates[name], function (err) {
              if (err) {
                log.error({module: 'server'}, {err: err}, "Error writing compiled template to file '%s'", outputFile);
              }
            });
          });
        });
      }
    }

    // handle templates that are requested but not found in the cache
    // `templateName` is the name of the template requested by dust.render / dust.stream
    // or via a partial include, like {> "hello-world" /}
    dust.onLoad = function(templateName, opts, callback) {
      var template = templateName + '.dust';
      if (template.indexOf('partials') > -1) {
        template = partialPath + '/' + template.replace('partials/', '');
      } else {
        template = templatePath + '/' + template;
      }

      fs.readFile(template, { encoding: 'utf8' }, function (err, data) {
        if (err) {
          // no template file found?
          return callback(err, null);
        }

        return callback(null, data);
      });
    };
}

Server.prototype.getSessionStore = function(sessionConfig) {
  var env = config.get('env');
  if (/development|test/.exec(env) === null) {
    if (sessionConfig.store === '') {
      var message = '';
      message += 'It is not recommended to use an in-memory session store in the ' + env + ' environment. Please change the configuration to one of the following:\n\n';

      sessionConfig.store = 'mongodb://username:password@host/databaseName';
      message += 'MongoDB:\n'.green;
      message += JSON.stringify(sessionConfig, null, 2);
      message += '\n\n';

      sessionConfig.store = 'redis://<redis_server_host>:<redis_server_port>';
      message += 'Redis\n'.green;
      message += JSON.stringify(sessionConfig, null, 2);
      message += '\n\n';

      sessionConfig.store = '';

      throw new Error(message);
    }

    //app.set('trust proxy', 1) // trust first proxy
    //sess.cookie.secure = true // serve secure cookies
  }

  if (sessionConfig.store === '') {
    return null;
  }

  if (sessionConfig.store.indexOf('mongodb') > -1) {
    return new mongoStore({
		  url: sessionConfig.store
    });
  }
  else if (sessionConfig.store.indexOf('redis') > -1) {
    return new RedisStore({
      url: sessionConfig.store
    });
  }
}

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function (options, done) {
    var self = this;

    // create workspace directories if they don't exist
    // permissions default to 0777
    var idx = 0;
    _.each(options, function(dir) {
      mkdirp(dir, {}, function (err, made) {
        if (err) {
          log.error({module: 'server'}, err);
          console.log(err);
        }

        if (made) {
          log.info({module: 'server'}, 'Created directory ' + made);
          console.log('Created directory ' + made);
        }

        idx++;

        if (idx === Object.keys(options).length) return done();
      });
    });
};

/**
 *  Expose VERB type methods for adding routes and middlewares
 *
 *  @param {String} [route] optional
 *  @param {function} callback, any number of callback to be called in order
 *  @return undefined
 *  @api public
 */
Server.prototype.options = buildVerbMethod('options');
Server.prototype.get = buildVerbMethod('get');
Server.prototype.head = buildVerbMethod('head');
Server.prototype.post = buildVerbMethod('post');
Server.prototype.put = buildVerbMethod('put');
Server.prototype.delete = buildVerbMethod('delete');
Server.prototype.trace = buildVerbMethod('trace');

// singleton
module.exports = new Server();

// generate a method for http request methods matching `verb`
// if a route is passed, the node module `path-to-regexp` is
// used to create the RegExp that will test requests for this route
function buildVerbMethod(verb) {
  return function () {
    var args = [].slice.call(arguments, 0);
    var route = typeof arguments[0] === 'string' ? args.shift() : null;

    var handler = function (req, res, next) {
      if (!(req.method && req.method.toLowerCase() === verb)) {
        next();
      }

      // push the next route on to the bottom of callback stack in case none of these callbacks send a response
      args.push(next);
      var doCallbacks = function (i) {
        return function (err) {
          if (err) return next(err);

          args[i](req, res, doCallbacks(++i));
        };
      };

      doCallbacks(0)();
    };

    // if there is a route provided, only call for matching requests
    if (route) {
      return this.app.use(route, handler);
    }

    // if no route is provided, call this for all requests
    this.app.use(handler);
  };
}

function onConnection(socket) {
  // set a timeout for the client connection
  socket.setTimeout(config.get('server.socketTimeoutSec') * 1000);
  socket.on('timeout', function() {
    socket.end();
  });
}

function onListening(e) {

  // check that our API connection is valid
  help.isApiAvailable(function(err, result) {

    if (err) {
      console.log(err);
      console.log();
      process.exit(0);
    }

    var env = config.get('env');

    // var webMessage = "Started DADI Web '" + config.get('app.name') + "' (" + version + ", Node.JS v" + nodeVersion + ", " + env + " mode) on " + config.get('server.host') + ":" + config.get('server.port');
    // var apiMessage = "";

    // if (config.get('api.enabled') === true) {
    //   apiMessage += "Attached to DADI API on " + config.get('api.host') + ":" + config.get('api.port');
    // }

    var startText = '';
    startText += '  ----------------------------\n';
    startText += '  ' + config.get('app.name').green + '\n';
    startText += '  Started \'DADI Web\'\n';
    startText += '  ----------------------------\n';
    startText += '  Server:      '.green + config.get('server.host') + ':' + config.get('server.port') + '\n';
    startText += '  Version:     '.green + version + '\n';
    startText += '  Node.JS:     '.green + nodeVersion + '\n';
    startText += '  Environment: '.green + env + '\n';
    if (config.get('api.enabled') === true) {
    startText += '  API:         '.green + config.get('api.host') + ":" + config.get('api.port') + '\n';
    }
    else {
    startText += '  API:         '.green + 'Not found'.red + '\n';
    }
    startText += '  ----------------------------\n';

    if (env !== 'test') {
      console.log(startText);
      console.log('  Copyright %s 2015 DADI+ Limited (https://dadi.tech)'.white, String.fromCharCode(169));
    }
  });
}

function onError(err) {
  if (err.code == 'EADDRINUSE') {
    var message =  'Can\'t connect to local address, is something already listening on port ' + config.get('server.port') + '?';
    err.localIp = config.get('server.host');
    err.localPort = config.get('server.port');
    err.message = message;
    console.log(err);
    console.log();
    process.exit(0);
  }
}

function processSortParameter(obj) {
  var sort = {};
  if (typeof obj !== 'object' || obj === null) return sort;

  _.each(obj, function(value, key) {
    if (typeof value === 'object' && value.hasOwnProperty('field') && value.hasOwnProperty('order')) {
      sort[value.field] = (value.order === 'asc') ? 1 : -1;
    }
  });

  return sort;
}

function parseRoutes(endpoints, req_path) {
  var params = {};
  var route_path = '';
  _.each(endpoints, function(endpoint) {
    var paths = endpoint.page.route.paths;
    var req_path_items = req_path.split('/');
    _.each(paths, function(path) {
      path_items = path.split('/');
      if(path_items.length == req_path_items.length) {
        var alias = _.filter(path_items, function(item) {
          return item == '' || item.slice(0, 1) != ':';
        });

        if(_.difference(alias, _.intersection(path_items, req_path_items)).length == 0) {
          _.each(path_items, function(item, index) {
            if(item != '' && item.slice(0, 1) == ':')  {
              params[item.slice(1)] = req_path_items[index];
            }
          });
          route_path = path;
        }
      }
    });
  });

  return {
    route_path : route_path,
    params: params
  };
}
