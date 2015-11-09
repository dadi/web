### Events

#### More on Events

Events are server side JavaScript and can add additional functionality to a page/dust template. Events can serve as a useful way to implement logic to a logicless Dust template.

Use case:
A Rosecomb developer would like count how many people clicked on a 'plus' button.

To achieve this he has to create a new event and attach it to the page where he has the 'plus' button.

The developer then implements a code in the event which will look for specific event (i.e. POST buttonpressed) and inside this he will increase a counter stored in a text file.

The developer then returns the updated counter number from the event which is made accessible within the Dust template.


Events are assigned to pages in the page descriptor file.

```
{
    "page": {
      "name": "Car Reviews",
      "description": "A collection of car reviews.",
      "language": "en",
      "cache": true
    },
    "route": "/car-reviews/:make/:model",
    "template": "car-reviews.dust",
    "datasources": [
      "car-makes",
      "car-models"
    ],
    "events": [
		  "myCustomEvent"
    ]
}

```

#### Sample event file

```js
/* optional Node includes */
var path = require('path');
var http = require("http");
var querystring = require('querystring');

/* optional Rosecomb includes */
var config = require(__dirname + '/../../config.js');

// the `data` parameter contains the data already loaded by
// the page's datasources and any previous events that have fired

var Event = function (req, res, data, callback) {

  var result = {};

  if (data.car-makes && data.car-makes.results) {
    result = {
      carMakeFromEvent: data.car-makes.results[0].name
    };
  }
  else {
    result = {
      carMakeFromEvent: "No make found in supplied data."
    };
  }

  // return a null error and the result
  callback(null, result);
};

module.exports = function (req, res, data, callback) {
    return new Event(req, res, data, callback);
};

module.exports.Event = Event;

```
