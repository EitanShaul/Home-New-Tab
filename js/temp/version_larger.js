
// Update Check
(function () {

function versionLargerThan(a, b) {
  var v1 = a.split('.'), v2 = b.split('.');
  var len = Math.max(v1.length, v2.length);
  for (var i = 0; i < len; i++)
    if (parseInt(v1[i]||-1, 10) > parseInt(v2[i]||-1, 10))
      return true; 
  return false;
}

})();
