
// offscreen_call
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'offscreen_call') return;
  const result = globalThis[message.name].apply(globalThis, message.args);
  if (result instanceof Promise) {
    result.then(sendResponse);
    return true; // keep channel open
  }
  sendResponse(result);
});


// Offscreen storage
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen_storage') return;

  switch (message.operation) {
    case 'getItem':
      sendResponse(localStorage.getItem(message.key));
      break;
      
    case 'setItem':
      localStorage.setItem(message.key, message.value);
      sendResponse(undefined);
      break;
      
    case 'removeItem':
      localStorage.removeItem(message.key);
      sendResponse(undefined);
      break;
      
    case 'clear':
      localStorage.clear();
      sendResponse(undefined);
      break;
      
    case 'key':
      sendResponse(localStorage.key(message.key));
      break;
      
    case 'length':
      sendResponse(localStorage.length);
      break;

    // non-standard but useful for efficient initialization
    case '_getAll_':
      sendResponse(localStorage);
      break;
  }
});

window.addEventListener('storage', (e) => {
  bg_call('on_localStorage_change', {
    key: e.key,
    newValue: e.newValue,
    oldValue: e.oldValue,
    url: e.url
  });
});

// Public interface
window.stored = localStorage;

// we call it bg_call cause rpc means the other way (from bg to ext pages)
async function bg_call(method, ...args) {
  return chrome.runtime.sendMessage({
    type: 'bg_call',
    name: method,
    args: args,
  });
}
