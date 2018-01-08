const Event = function (req, res, data, callback) {
  if (req.method.toLowerCase() === 'post') {
    data.expectedData = {
      files: req.files,
      body: req.body
    }
  }

  callback(null)
}

module.exports = function (req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
