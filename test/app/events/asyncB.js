var Event = function(req, res, data, callback) {
  setTimeout(() => {
    data = `A said: "${data.asyncA}"`

    callback(null, data)
  }, 200)
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
