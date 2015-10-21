var bunyan = require('bunyan');
var fs = require('fs');
var mkdirp = require('mkdirp');
var moment = require('moment');
var path = require('path');
var _ = require('underscore');

var config = require(path.resolve(__dirname + '/../../config.js'));

var logPath = path.resolve(config.get('logging.path') + '/' + config.get('logging.filename') + '.' + config.get('env') + '.' + config.get('logging.extension'));

var levelMap = {
    'DEBUG': 1,
    'STAGE': 2,
    'PROD': 3
};

// generate formatter function
var formatter = compile(config.get('logging.messageFormat'));

var stream;

// create log directory if it doesn't exist
mkdirp(path.resolve(config.get('logging.path')), {}, function(err, made) {
    if (err) {
        console.log('[LOGGER] ' + err);
        module.exports.prod('[LOGGER] ' + err);
    }

    if (made) {
        module.exports.prod('[LOGGER] Log created at ' + made);
    }
});

// create writeStream to log
var options = { flags: 'a',
                encoding: 'utf8',
                mode: 0666 }

stream = fs.createWriteStream(logPath, options);

stream.on('error', function (err) {
    console.log('stream error');
    console.error(err);
});

stream.on('finish', function () {
    console.log('stream finish');
});

var log = bunyan.createLogger({
    name: 'rosecomb',
    streams: [
        {
          level: 'info',
          //path: logPath
          stream: process.stdout            // log INFO and above to stdout
        },
        {
          level: 'error',
          path: logPath  // log ERROR and above to a file
        }
    ]
});

var self = module.exports = {

    info: function info() {
        log.info.apply(log, arguments);
    },

    error: function error() {
        log.error.apply(log, arguments);
    },

    trace: function error() {
        log.trace.apply(log, arguments);
    }

}

module.exports.logLevel = function () {
    return config.get('logging.level').toUpperCase();
};

/**
 * Log string to file system
 *
 * @param {String} message
 * @param {Function} [done]
 * @return undefined
 * @api private
 */
module.exports._log = function (message, done) {
    if (stream) {
        console.log(message);
        stream.write(message);
    }
    done && done();
};

/**
 * Format Object to a string
 *
 * @param {Object} data
 * @return String
 * @api public
 */
module.exports.format = function (data) {
    // add default info
    data.date = moment().format(config.get('logging.dateFormat'));
    data.label = config.get('logging.level');
    return formatter(data) + '\n';
};

/**
 * Log message if running at debug level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.debug = function (message, done) {
    if ((levelMap[module.exports.logLevel()] || 0) < levelMap['DEBUG']) return;
    module.exports._log(this.format({message: message}), done);
};

// module.exports.info = function (message) {
//     log.info(message);
// };

/**
 * Log message if running at stage level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.stage = function (message, done) {
    if ((levelMap[module.exports.logLevel()] || 0) < levelMap['STAGE']) return;
    module.exports._log(this.format({message: message}), done);
};

/**
 * Log message if running at production level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.prod = function (message, done) {
    if ((levelMap[module.exports.logLevel()] || 0) < levelMap['PROD']) {
        if (message)
            console.log(message);
        return;
    }
    module.exports._log(this.format({message: message}), done);
};

/**
 * Compile `fmt` into a function.
 *
 * @param {String} fmt
 * @return {Function}
 * @api private
 */
function compile(fmt) {
    return _.template(fmt);
}
