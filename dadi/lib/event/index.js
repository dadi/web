/**
 * @module Event
 */
const path = require('path')
const log = require('@dadi/logger')

const Event = function (pageName, eventName, options) {
  this.page = pageName
  this.name = eventName
  this.options = options || {}
}

Event.prototype.loadEvent = function () {
  const filepath = path.join(this.options.eventPath, this.name + '.js')

  try {
    // get the event
    return require(filepath)
  } catch (err) {
    throw new Error(
      `Page "${this.page}" references event "${
        this.name
      }" which can't be found in "${this.options.eventPath}"`
    )
  }
}

Event.prototype.run = function (req, res, data, done) {
  try {
    this.loadEvent()(req, res, data, (err, result) => {
      if (err) {
        log.error(
          {
            module: 'event',
            event: this.name,
            page: this.page,
            url: req.url,
            params: req.params,
            options: this.options
          },
          err
        )
      }

      return done(err, result)
    })
  } catch (err) {
    log.error(
      {
        module: 'event',
        event: this.name,
        page: this.page,
        url: req.url,
        params: req.params,
        options: this.options
      },
      err
    )
    return done(null, null)
  }
}

module.exports = function (pageName, eventName, options) {
  return new Event(pageName, eventName, options)
}

module.exports.Event = Event
