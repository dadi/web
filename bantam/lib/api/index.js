var http = require('http');
var url = require('url');
var pathToRegexp = require('path-to-regexp');
var raven = require('raven');
var _ = require('underscore');

var log = require(__dirname + '/../log');
var config = require(__dirname + '/../../../config');

/**
 * Represents the main server.
 * @constructor
 */
var Api = function () {
    this.paths = [];
    this.all = [];
    this.errors = [];

    this.log = log.get().child({module: 'api'});

    // Sentry error handler
    if (config.get('logging.sentry.enabled')) {
      this.errors.push(raven.middleware.express.errorHandler(config.get('logging.sentry.dsn')));
    }

    // Fallthrough error handler
    this.errors.push(onError(this));

    // permanently bind context to listener
    this.listener = this.listener.bind(this);
};

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function (path, handler) {

    if (typeof path === 'function') {
        if (path.length === 4) return this.errors.push(path);
        return this.all.push(path);
    }

    var regex = pathToRegexp(path);

    this.paths.push({
        path: path,
        order: routePriority(path, regex.keys),
        handler: handler,
        regex: regex
    });

    this.paths.sort(function (a,b) {
        return b.order - a.order;
    });
};

/**
 *  Removes a handler or removes the handler attached to a specific path
 *  @param {String} path
 *  @return undefined
 *  @api public
 */
Api.prototype.unuse = function (path) {
    var indx = 0;
    if (typeof path === 'function') {
        if (path.length === 4) {
            indx = this.errors.indexOf(path);
            return !!~indx && this.errors.splice(indx, 1);
        }

        var functionStr = path.toString();
        _.each(this.all, function (func) {
            if (func.toString() === functionStr) {
                return this.all.splice(indx, 1);
            }
            else {
                indx++;
            }
        }, this);

        // indx = this.all.indexOf(path);
        // return !!~indx && this.all.splice(indx, 1);
    }
    var existing = _.findWhere(this.paths, { path: path });
    this.paths = _.without(this.paths, existing);
};

/**
 *  convenience method that creates http server and attaches listener
 *  @param {Number} port
 *  @param {String} host
 *  @param {Number} backlog
 *  @param {Function} [done]
 *  @return http.Server
 *  @api public
 */
Api.prototype.listen = function (port, host, backlog, done) {
    return http.createServer(this.listener).listen(port, host, backlog, done);
};

/**
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.listener = function (req, res) {

    // clone the middleware stack
    var stack = this.all.slice(0);
    var path = url.parse(req.url).pathname;

    req.paths = [];

    // get matching routes, and add req.params
    var matches = this._match(path, req);

    var originalReqParams = req.params;

    var doStack = function (i) {
        return function (err) {

            if (err) return errStack(0)(err);

            // add the original params back, in case a middleware
            // has modified the current req.params
            _.extend(req.params, originalReqParams);

            try {
              stack[i](req, res, doStack(++i));
            }
            catch (e) {
              return errStack(0)(e);
            }
        };
    };

    var self = this;
    var errStack = function (i) {
        return function (err) {
            self.errors[i](err, req, res, errStack(++i));
        };
    };

    // add path specific handlers
    stack = stack.concat(matches);

    // add 404 handler
    stack.push(notFound(this, req, res));

    // start going through the middleware/routes
    doStack(0)();
};

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {String} path
 *  @param {http.IncomingMessage} req
 *  @return Array
 *  @api private
 */
Api.prototype._match = function (path, req) {
    var paths = this.paths;
    var matches = [];
    var handlers = [];

    // always add params object to avoid need for checking later
    req.params = {};

    for (i = 0; i < paths.length; i++) {
        var match = paths[i].regex.exec(path);

        if (!match) { continue; }

        req.paths.push(paths[i].path);

        var keys = paths[i].regex.keys;
        handlers.push(paths[i].handler);

        match.forEach(function (k, i) {
            var keyOpts = keys[i] || {};
            if (match[i + 1] && keyOpts.name && !req.params[keyOpts.name]) req.params[keyOpts.name] = match[i + 1];
        });

        //break;
    }

    return handlers;
};

module.exports = function () {
    return new Api();
};

module.exports.Api = Api;

function onError(api) {
  return function (err, req, res, next) {

    if (config.get('env') === 'development') {
      console.log();
      console.log(err.stack.toString());
    }

    api.log.error(err);

    var message = "<html><head><title>DADI Web - 500 Internal Server Error</title></head>";
    message += "<body>";
    message += "<h1>Internal Server Error</h1>";
    message += "<p>The server encountered an internal error or misconfiguration and was unable to complete your request.</p>";

    // The error id is attached to `res.sentry` to be returned and optionally displayed to the user for support.
    if (res.sentry) message += "<p>This error has been logged and the development team notified. The unique ID associated with this error is <b>" + res.sentry + "</b>.</p>";

    message += "<blockquote>";
    message += "<pre>" + err.stack.toString(); + "</pre>";
    message += "</blockquote>";
    message += "</body></html>";

    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html');
    res.end(message);
  };
}

// return a 404
function notFound(api, req, res) {
    return function () {

        res.statusCode = 404;

        // look for a 404 page that has been loaded
        // along with the rest of the API, and call its
        // handler if it exists

        var path = _.findWhere(api.paths, { path: '/404' });
        if (path) {
            path.handler(req, res);
        }
        // otherwise, respond with default message
        else {
            res.end("404: Ain't nothing here but you and me.");
        }
    };
}

function routePriority(path, keys) {

    var tokens = pathToRegexp.parse(path);

    var staticRouteLength = 0;
    if (typeof tokens[0] === 'string') {
        staticRouteLength = _.compact(tokens[0].split('/')).length;
    }

    var requiredParamLength = _.filter(keys, function (key) {
        return !key.optional;
    }).length;

    var optionalParamLength = _.filter(keys, function (key) {
        return key.optional;
    }).length;

    var order = (staticRouteLength * 5) + (requiredParamLength * 2) + (optionalParamLength);
    if (path.indexOf('/config') > 0) order = -10;

    return order;
}
