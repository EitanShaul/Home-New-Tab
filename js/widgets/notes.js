// (c) copyright 2019 Balázs Galambosi (support@homenewtab.com)

//
// Notes
//

(function(){

var timer;

if (stored.notes1) {
  var note1 = stored.notes1.split("%%");
  byId("qnote-title").innerHTML = note1[0];
  byId("qnote-text").innerHTML  = note1[1];
}

byId('qnote').oninput = function() {
    clearTimeout(timer);
    timer = setTimeout(function(){
      stored.notes1 = byId("qnote-title").innerHTML + "%%" +  byId("qnote-text").innerHTML;
    }, 50);
}

byId("qnote-text").onfocus = function(e) {
  byId("qnote-editor").style.opacity = 1;
  byId("qnote-editor").style.pointerEvents = '';
  init_editor();
}

byId("qnote-text").onblur = function(e) {
  byId("qnote-editor").style.opacity = 0;
  byId("qnote-editor").style.pointerEvents = 'none';
}

byId("qnote-editor").onmousedown = function(e) {
  e.preventDefault();
}

byId("qnote-editor").onclick = function(e) {
  byId("qnote-text").focus();
  var cmd = e.target.dataset.cmd;
  if (cmd)
    document.execCommand (cmd, false, null);
}

function init_editor() {
  if (byId("qnote-editor").dataset.initDone) return;
  byId("qnote-editor").dataset.initDone = true;
  
  byId("qnote-editor").innerHTML = `
    <i class="fas fa-undo" data-cmd="undo" title="undo"></i>
    <i class="fas fa-undo" data-cmd="redo" title="redo" style="transform: scaleX(-1);"></i>
    <i class="far fa-bold" data-cmd="bold" title="bold" ></i>
    <i class="far fa-italic" data-cmd="italic" title="italic"></i>`;
    // <i class="fas fa-font" data-cmd="font"></i>
  /*
  byId("qnote-editor").innerHTML = `
    <img src="icons/editor/undo.png" data-cmd="undo" />
    <img src="icons/editor/redo.png" data-cmd="redo" />
    <img src="icons/editor/bold.png" data-cmd="bold" />
    <img src="icons/editor/italics.png" data-cmd="italic" />`;
  */
}

document.on('keydown', function (e) { 
  // detect 'tab' key
  var TAB_KEY = 9;
  if (e.keyCode != TAB_KEY || !e.target.isContentEditable) return;
	var selectedText = window.getSelection().toString();
	var isMultiLine = selectedText.indexOf('\n') != -1;
	if (isMultiLine) {
  	document.execCommand(e.shiftKey ? 'outdent' : 'indent', false);
	} else {
		document.execCommand('insertText', false, "\t");
	}
	// don't swich focus to next tabindex
  e.preventDefault(); 
});

function to_plain_text_on_paste(e) {
  e.preventDefault();
  var clipboardData = e.clipboardData || window.clipboardData;
  var text = clipboardData.getData('text');
  window.document.execCommand('insertText', false, text);
}

byId("qnote-text").addEventListener('paste', to_plain_text_on_paste);

})();
