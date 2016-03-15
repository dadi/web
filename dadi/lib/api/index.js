var http = require('http');
var url = require('url');
var pathToRegexp = require('path-to-regexp');
var raven = require('raven');
var _ = require('underscore');

var log = require(__dirname + '/../log');
var config = require(__dirname + '/../../../config');

var MiddlewareEngine = require('../../../../middleware');

/**
 * Represents the main server.
 * @constructor
 */
var Api = function () {

    var api = new MiddlewareEngine();

    // Sentry error handler
    if (config.get('logging.sentry.dsn') !== '') {
      api.use(raven.middleware.express.errorHandler(config.get('logging.sentry.dsn')));
    }

    // Fallthrough error handler
    api.use(onError);

    return api;
};

/**
 * Add Api methods here...
 */


module.exports = function () {
    return new Api();
};

module.exports.Api = Api;

function onError(err, req, res, next) {

    // I'm leaving this here for legacy, but if `res.finished === true` we are doing something wrong
    if (res.finished) return;

    log.error({module: 'api'}, err);

    // TODO: don't put HTML templates here
    var message = '<html><head><title>DADI Web - 500 Internal Server Error</title></head>';
    message += '<body>';
    message += '<h1>Internal Server Error</h1>';
    message += '<p>The server encountered an internal error or misconfiguration and was unable to complete your request.</p>';

    // The error id is attached to `res.sentry` to be returned and optionally displayed to the user for support.
    if (res.sentry) {
        message += '<p>This error has been logged and the development team notified.';
        message += ' The unique ID associated with this error is <b>' + res.sentry + '</b>.</p>';
    }

    if (config.get('env') === 'development') {
        console.log();
        console.log(err.stack.toString());
        message += '<blockquote>';
        message += '<pre>' + err.stack.toString(); + '</pre>';
        message += '</blockquote>';
    }

    message += '</body></html>';

    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/html');
    res.end(message);

};
