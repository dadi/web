var config = require(__dirname + '/../../config.json');
var help = require(__dirname + '/../../bantam/lib/help');

module.exports.getCategories = function (req, res, callback) {  
  console.log("constraints.js: getCategories");
  console.log(req.params);

  return callback(false);
};

