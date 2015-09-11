
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

});
