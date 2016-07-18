/* TODO: migrate logic and test, test, test!!
 */

var StaticProvider = function () {}

StaticProvider.prototype.initialise = function (schema) {
  this.schema = schema
}

StaticProvider.prototype.loadData = function(done) {
  var data = this.schema.source.data;

  if (_.isArray(data)) {
    var sortField = this.schema.datasource.sort.field;
    var sortDir = this.schema.datasource.sort.order;
    var search = this.schema.datasource.search;
    var count = this.schema.datasource.count;
    var fields = this.schema.datasource.fields;

    if (search) data = _.where(data, search);
    if (sortField) data = _.sortBy(data, sortField);
    if (sortDir === 'desc') data = data.reverse();

    if (count) data = _.first(data, count);

    if (fields) data = _.chain(data).selectFields(fields.join(",")).value();
  }

  done(data);
}

module.exports = StaticProvider
