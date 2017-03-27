var config = require(__dirname + '/../../config.js');
var help = require(__dirname + '/../../dadi/lib/help');

module.exports.getCategories = function (req, res, callback) {  
  console.log("constraints.js: getCategories");
  console.log(req.params);

  return callback(false);
};

