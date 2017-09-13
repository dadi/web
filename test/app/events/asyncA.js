var Event = function(req, res, data, callback) {
  setTimeout(() => {
    data = "Modified by A"

    callback(null, data)
  }, 300)
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
