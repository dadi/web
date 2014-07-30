var fs = require('fs');

var parseFile = function(filename, callback) {

  fs.readFile(filename, 'utf-8', function(err, data) {
    if (err) {
      callback({ status: 'DEFINITION_MISSING', message: 'Definition file missing: ' + filename });
    }
    else {
      try {
        callback(JSON.parse(data));
      }
      catch (e) {
        callback({ status: 'DEFINITION_ISSUE', message: 'Unable to parse definition file, is it valid JSON? (' + filename + ')' });
      }
    }
  });

};

module.exports = parseFile;

//exports.parseFile = function(filename) {
//  var errors = {}
  // fs.readFile(filename, 'utf-8', function(err, data) {
  //   if (err) {
  //     errors.datasource = { status: 'DATASOURCE_DEFINITION_MISSING', message: 'Datasource definition missing: ' + filename };
  //   }
  //   else {
  //     try {
  //       // Is the definition file valid JSON?
  //       datasources[ds] = JSON.parse(data);
  //     }
  //     catch (e) {
  //       errors.datasource = { status: 'DATASOURCE_DEFINITION_ISSUE', message: 'Unable to parse datasource definition, is it valid JSON? (' + filename + ')' };
  //     }
  //   }
  // });
//   return filename;
// };
