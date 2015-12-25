/*

https://github.com/thegreatape/node-fakeweb

customised fakeweb so it:
  includes request.write() and request.on() methods
  tests supplied headers against rule headers

*/

var http = require('http'),
    events = require('events'),
    sys = require('sys'),
    nodeunit = require('nodeunit'),
    _ = require('underscore');

var intercept_rules = [];

function match_rule(options){

  var matched_rule;

  intercept_rules.forEach(function(rule) {

    if (matched_rule) return matched_rule;

    var keys = Object.keys(rule),
        matches = {},
        match = false;

    // TODO headers matching and regex support
    keys.forEach(function(key){

      if (options[key]) {
        if (rule[key] instanceof RegExp) {
          matches[key] = rule[key].test(options[key]);
        }
        else if (typeof options[key] === 'object' && typeof rule[key] === 'object') {
          matches[key] = JSON.stringify(options[key]) ===  JSON.stringify(rule[key]);
        }
        else {
          matches[key] = options[key].toString() === rule[key].toString();
        }
      }
    });

    match = _.every(matches);

    if (match) {
      matched_rule = rule;
      //console.log("matched: " + JSON.stringify(rule))
    }
  });

  return matched_rule;
}

http.register_intercept = function(options){
    intercept_rules.push(options);
};

http.unregister_intercept = function(options){
    intercept_rules.forEach(function(rule, i){
        var equal = true;
        Object.keys(rule).forEach(function(k){
            if(rule[k] != options[k]){
                equal = false;
            }
        });
        if(equal){
            intercept_rules.splice(i, 1);
        }
    });
};

http.clear_intercepts = function(){
    intercept_rules = [];
};

http.get_intercepts = function(){
    return intercept_rules;
};

http.replyWithError = function(err) {
  
}

// wrap http.request with interceptor function
var old_request = http.request;
http.request = function(options, callback) {
    var rule = match_rule(options);

    if (rule) {

        var res = new events.EventEmitter();
        res.headers = rule.headers || {'Content-Type': 'text/html'};
        res.setTimeout = function(ms) { };

        return {
          on: function(event, callback) {

          },
          write: function(data) {
            //console.log(data);
          },
          end: function() {
            callback(res);
            res.emit('data', rule.body || '');
            res.emit('end');
          }
        };
    }
    else {
      return old_request.call(http, options, callback);
    }
};

var fakewebTestCase = function(cases){
    var tearDown = function(cb){
        http.clear_intercepts();
        cb();
    };
    if(cases.tearDown){
        var old = cases.tearDown;
        cases.tearDown = function(done){
            var self = this;
            tearDown.call(self, function(){
                old.call(self, done);
            });
        }
    } else {
        cases.tearDown = tearDown;
    }
    return nodeunit.testCase.call(this, cases);
};
sys.inherits(fakewebTestCase, nodeunit.testCase);
module.exports.testCase = fakewebTestCase;
