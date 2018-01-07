const Event = function (req, res, data, callback) {
  data.files = req.files
  data.body = req.body

  console.log(data)

  callback(null)
}

module.exports = function (req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
