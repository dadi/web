#! /usr/bin/env node

console.log(process.env['GIT_PARAMS'])

var validateMessage = function(message) {
  console.log("commitmsg.js", message)
  var isValid = true
  return isValid
}
