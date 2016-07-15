/* SimpleProvider
 * this is intended for test purposes, to test that the datasource/provider
 * pipeline is working properly without worrying about an external datasource
 */

var data = [
  { id: 0, name: 'test_1' },
  { id: 1, name: 'test_2' },
  { id: 2, name: 'test_3' },
  { id: 3, name: 'test_4' },
  { id: 4, name: 'test_5' },
  { id: 5, name: 'test_6' },
  { id: 6, name: 'test_7' },
  { id: 7, name: 'test_8' },
  { id: 8, name: 'test_9' },
  { id: 9, name: 'test_10' }
]

var SimpleProvider = function () {}

SimpleProvider.prototype.initialise = function (schema) {
  this.schema = schema
}

module.exports = SimpleProvider
