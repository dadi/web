
$(document).ready(function() {

  var el = {
      source: $('#source'),
      result: $('#debug')
  };

  var json = el.source[0].innerText;
  var data;
  
  try {
  	data = JSON.parse(json);
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

    // highlight matches
    $found.css("background", "red");

    // clear all
    if (input === "") el.result.find(selector).css("background", "none");
  });

});
