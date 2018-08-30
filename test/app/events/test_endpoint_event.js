// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired
const Event = function(req, res, data, callback) {
  callback(null, "http://www.feedforall.com:80/sample.json")
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
