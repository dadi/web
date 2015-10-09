#! /usr/bin/env node
var path = require('path');

var coberturaBadger = require('istanbul-cobertura-badger');

var opts = {
  badgeFileName: "coverage",
  destinationDir: __dirname,
  istanbulReportFile: path.resolve(__dirname + "/../coverage", "cobertura-coverage.xml"),
  thresholds: {
    excellent: 90, // overall percent >= excellent, green badge
    good: 60 // overall percent < excellent and >= good, yellow badge
    // overall percent < good, red badge
  }
};

//console.log(opts);

// Load the badge for the report$
coberturaBadger(opts, function parsingResults(err, badgeStatus) {
  if (err) {
    console.log("An error occurred: " + err.message);
  }
  console.log("Coverage badge successfully generated at " + badgeStatus.badgeFile.filePath);
  //console.log(badgeStatus);
});