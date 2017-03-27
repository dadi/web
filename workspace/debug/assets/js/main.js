
$(document).ready(function() {

  var el = {
      source: $('#source'),
      result: $('#debug')
  };

  var json = el.source[0].value.replace(/\n/g,"");
  var data;

  try {
  	data = JSON.parse(json);
    delete data.stats;
    console.log(data);
  }
  catch (e) {
		console.log('not valid JSON');
    return;
  }

  var node = new PrettyJSON.view.Node({
    el:el.result,
    data: data,
    dateFormat:"DD/MM/YYYY - HH24:MI:SS"
  });

  $('#collapse').on('click', function() {
      node.collapseAll();
  });

  $('#expand').on('click', function() {
      node.expandAll();
  });

  node.expandAll();

  $('#pathTester').on('change keydown paste input', function () {

    var input = $(this).val();
    var testArray = input.split('.');
    var selector = "";

    for (var i = 0; i < testArray.length; i++) {
      selector += "span:contains('" + testArray[i] + "') ";
    };

    console.log(selector);
    var $found = el.result.find(selector);

    // clear all
    el.result.find('span').css("background", "none");

    el.result.find('span.title').css("color", "#DECCFF");
    el.result.find('span.string').css("color", "#080");
    el.result.find('span.number').css("color", "#ccaa00");
    el.result.find('span.boolean').css("color", "#1979d3");
    el.result.find('span.date').css("color", "#aa6655");
    el.result.find('span.null').css("color", "#ff5050");

    // highlight matches
    $found.css("background", "#465DAA");
    $found.css("color", "#FFF");

    // clear all
    if (input === "") {
      el.result.find(selector).css("background", "none");

      el.result.find('span.title').css("color", "#DECCFF");
      el.result.find('span.string').css("color", "#080");
      el.result.find('span.number').css("color", "#ccaa00");
      el.result.find('span.boolean').css("color", "#1979d3");
      el.result.find('span.date').css("color", "#aa6655");
      el.result.find('span.null').css("color", "#ff5050");
    }
  });

});
