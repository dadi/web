var fs = require('fs')
var path = require('path')
var colors = require('colors')

var testConfigPath = './config/config.test.json'
var testConfigSamplePath = './config/config.test.json.sample'

function loadConfig () {
  try {
    var testConfig = fs.readFileSync(testConfigPath, { encoding: 'utf-8' })
  } catch (err) {
    if (err.code === 'ENOENT') {
      var testConfigSample = fs.readFileSync(testConfigSamplePath, {
        encoding: 'utf-8'
      })

      fs.writeFileSync(testConfigPath, testConfigSample)
      loadConfig()
    }
  }
}

function stop () {
  process.exit(1)
}

loadConfig()
