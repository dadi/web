// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired
var Event = function(req, res, data, callback) {
  data.global_event = "FIRED"

  callback(null, data)
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
