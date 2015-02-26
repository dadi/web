var app = require(__dirname + '/../bantam/lib/');

// Go!
app.start({
  configPath: __dirname + '/config.json',
  datasourcePath: __dirname + '/workspace/data-sources',
  pagePath: __dirname + '/workspace/pages',
  partialPath: __dirname + '/workspace/partials',
  eventPath: __dirname + '/workspace/events',
  mediaPath: __dirname + '/media',
  publicPath: __dirname + '/public'
});
