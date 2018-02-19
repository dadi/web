// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired
var Event = function(req, res, data, callback) {
  if (req.session) {
    req.session.active = true

    req.session.vehicles = {
      make: "mazda",
      edition: 3
    }

    req.session.save(err => {
      if (err) console.log(err)
      // session saved
    })

    data.session_id = req.session.id
  }

  callback(null, data)
}

module.exports = function(req, res, data, callback) {
  return new Event(req, res, data, callback)
}

module.exports.Event = Event
