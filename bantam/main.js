var app = require(__dirname + '/lib/');

// Go!
app.start({
  datasourcePath: __dirname + '/../workspace/data-sources',
  pagePath: __dirname + '/../workspace/pages',
  partialPath: __dirname + '/../workspace/partials',
  eventPath: __dirname + '/../workspace/events',
  routePath: __dirname + '/../workspace/routes',
  publicPath: __dirname + '/../public'
});
