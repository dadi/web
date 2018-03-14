const path = require('path')
const Send = require(path.join(__dirname, '/../view/send'))

module.exports = function (req, res, next, data, page) {
  // JSON view
  if (data.debugView === 'json') return Send.json(200, res, next)

  return function (err, results) {
    if (err) return next(err)
    console.log(data)

    res.end('hi')
  }
}
