var app = require(__dirname + '/index.js');
app.start();

// export the config module
module.exports.Config = require('./config');
module.exports.Log    = require(__dirname + '/dadi/lib/log.js');
