// Replace localStorage with chrome.storage.local
const storage = chrome.storage.local;

// Helper functions for storage
async function getStorageData(key) {
  return new Promise((resolve) => {
    storage.get(key, (result) => resolve(result[key]));
  });
}

async function setStorageData(key, value) {
  return new Promise((resolve) => {
    storage.set({ [key]: value }, resolve);
  });
}

// Initialize variables
let apps = {};
let hidden_apps = {};
let user_apps = {};
let custom_apps = {};
let custom_gmail, custom_facebook;

// SU (Closed Tabs) settings
const SU_settings = {numLimit: 20};

// Initialize on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await setStorageData('TEST_search_fullscreen', true);
    await setStorageData('SU_closedTabIdInc', 0);
    await setStorageData('install_time', Date.now());
  }
  
  // Initialize data
  apps = await getStorageData('apps') || {};
  hidden_apps = await getStorageData('hidden_apps') || {};
  user_apps = await getStorageData('user_apps') || {};
  custom_apps = await getStorageData('custom_apps') || {};

  // Initialize user app data
  await setStorageData('user_app_id_inc', await getStorageData('user_app_id_inc') || 0);
  await setStorageData('user_app_ids', await getStorageData('user_app_ids') || '');

  include_3rd_party_services();
});

// INSTALL & ENABLE
chrome.management.onInstalled.addListener((app) => {
  if (!app.isApp) return;

  apps[app.id] = app;

  // All views should update the UI
  chrome.runtime.sendMessage({ name: "add_new_app", id: app.id });

  // Active view should scroll to show the newly installed app
  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {name: "go_last_page"});
  });
});

chrome.management.onEnabled.addListener(async (app) => {
  if (app.isApp) {
    let iconsOrder = await getStorageData('icons_order') || '';
    await setStorageData('icons_order', iconsOrder + "," + app.id);
  }
});

// UNINSTALL & DISABLE
async function removeAppFromIcons(id) {
  let iconsOrder = await getStorageData('icons_order') || '';
  let ordered = iconsOrder.split(',').filter(appId => appId !== id);
  await setStorageData('icons_order', ordered.join(','));
  if (id.indexOf('user_app') === 0) {
    await remove_user_app(id);
  }
}

async function onUninstalled(id) {
  await removeAppFromIcons(id);
  if (custom_apps[id]) {
    apps[id].enabled = false;
    custom_apps[id] = false;
    await setStorageData('custom_apps', custom_apps);
  }
}

async function onDisabled(id) {
  await removeAppFromIcons(id);
  if (apps[id]) {
    apps[id].enabled = false;
    await setStorageData('apps', apps);
  }
}

async function hideChromeApp(id) {
  hidden_apps[id] = 1;
  await setStorageData('hidden_apps', hidden_apps);
  await removeAppFromIcons(id);
}

async function unhideChromeApp(id) {
  delete hidden_apps[id];
  await setStorageData('hidden_apps', hidden_apps);
  let iconsOrder = await getStorageData('icons_order') || '';
  iconsOrder = iconsOrder.replace(id, '').replace(/,,+/g, ',');
  iconsOrder += "," + id;
  await setStorageData('icons_order', iconsOrder);
  chrome.runtime.sendMessage({name: 'add_new_app', id: id});
}

chrome.management.onDisabled.addListener((app) => {
  if (app.isApp) onDisabled(app.id);
});

// User app functions
async function add_user_app(name, url, icons) {
  let userAppIdInc = await getStorageData('user_app_id_inc') || 0;
  let id = 'user_app_' + userAppIdInc;
  userAppIdInc++;
  await setStorageData('user_app_id_inc', userAppIdInc);

  let iconsOrder = await getStorageData('icons_order') || '';
  iconsOrder += "," + id;
  await setStorageData('icons_order', iconsOrder);

  apps[id] = {
    name: name,
    id: id,
    icons: icons,
    appLaunchUrl: url,
    isApp: true,
    enabled: true
  };

  await setStorageData('apps', apps);

  let userAppIds = await getStorageData('user_app_ids') || '';
  userAppIds += id + ',';
  await setStorageData('user_app_ids', userAppIds);

  chrome.runtime.sendMessage({name: 'add_new_app', id: id});

  chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {name: "go_last_page"});
  });

  on_user_app_init(apps[id]);

  return apps[id];
}

async function remove_user_app(id) {
  let userAppIds = await getStorageData('user_app_ids') || '';
  userAppIds = userAppIds.split(',').filter(appId => appId !== id).join(',');
  await setStorageData('user_app_ids', userAppIds);
  await storage.remove(id);
  if (apps[id].icons) {
    for (let icon of apps[id].icons) {
      await remove_file(extract_filename(icon.url));
    }
  }
}

function on_user_app_init(app) {
  let url = app.appLaunchUrl;
  if (url.indexOf('facebook.com') > -1)
    custom_facebook = app.id;
  else if (url.indexOf('gmail.com') > -1 || 
           url.indexOf('google.com/mail') > -1 ||
           url.indexOf('mail.google.com') > -1) 
    custom_gmail = app.id;
}

// Closed tabs functionality
async function addNewTab(tabId, changeInfo, tab) {
  if (!isTabRecordable(tab)) return;
  
  const tabData = JSON.stringify({
    index: tab.index,
    url: tab.url,
    title: tab.title || null,
    incognito: tab.incognito
  });
  
  await setStorageData(`SU_openTab:${tabId}`, tabData);
  await storeOpenTabId(tabId);
}

async function onRemoved(tabId, info) {
  await forgetOpenTabId(tabId);
  const tabJSON = await getStorageData(`SU_openTab:${tabId}`);
  await storage.remove(`SU_openTab:${tabId}`);

  if (!tabJSON) return;

  let tab;
  try {
    tab = JSON.parse(tabJSON);
  } catch (e) {
    console.error('ERROR: stored tab has invalid JSON:', tabId);
    return;
  }

  if (!isTabRecordable(tab)) return;

  const closedTabIdInc = await getStorageData('SU_closedTabIdInc') || 0;
  await setStorageData('SU_closedTabIdInc', closedTabIdInc + 1);
  await setStorageData(`SU_closedTab:${closedTabIdInc}`, tabJSON);

  const deleteId = closedTabIdInc - SU_settings.numLimit;
  await storage.remove(`SU_closedTab:${deleteId}`);
}

function isTabRecordable(tab) {
  return tab.url && /^(http:|https:|ftp:|file:)/i.test(tab.url);
}

async function storeOpenTabId(tabId) {
  let openTabIds = await getStorageData('SU_openTabIds') || {};
  openTabIds[tabId] = 1;
  await setStorageData('SU_openTabIds', openTabIds);
}

async function forgetOpenTabId(tabId) {
  let openTabIds = await getStorageData('SU_openTabIds') || {};
  delete openTabIds[tabId];
  await setStorageData('SU_openTabIds', openTabIds);
}

// Event listeners
chrome.tabs.onUpdated.addListener(addNewTab);
chrome.tabs.onRemoved.addListener(onRemoved);

chrome.webNavigation.onTabReplaced.addListener(async (details) => {
  const tab = await chrome.tabs.get(details.tabId);
  await addNewTab(details.tabId, null, tab);
  await storage.remove(`SU_openTab:${details.replacedTabId}`);
  await forgetOpenTabId(details.replacedTabId);
});

// 3rd party services
function include_3rd_party_services() {
  // This function needs to be adapted for Manifest V3
  // You may need to use dynamic imports or Web Workers
  // depending on your specific requirements
}

// Replace XMLHttpRequest with fetch
async function fetchData(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    if (body) options.body = body;

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getBackgroundData') {
    sendResponse({ apps, hidden_apps });
  }
  // Add other message handlers as needed
});

// Initialization
async function initialize() {
  // Crash recovery: Add all tabs to the ClosedTabs list from storage
  // that were open before crash (but currently are not)
  const storedOpenTabIds = await getStorageData('SU_openTabIds') || {};
  Object.keys(storedOpenTabIds).forEach(onRemoved);

  // Add already opened tabs on start
  const tabs = await chrome.tabs.query({});
  for (let tab of tabs) {
    await addNewTab(tab.id, null, tab);
  }

  // Get all installed extensions/apps
  chrome.management.getAll((array) => {
    build_apps_list(array);
    include_3rd_party_services();
  });
}

initialize();

// Additional functions (these may need to be adapted or removed based on your needs)
async function save_new_background(url, callback) {
  const blob = await fetch(url).then(r => r.blob());
  await save_file_blob('/background.jpg', blob);
  const newUrl = `filesystem:chrome-extension://${chrome.runtime.id}/persistent/background.jpg`;
  await setStorageData('background_image', newUrl);
  if (callback) callback();
}

// You may need to implement or adapt these functions:
// build_apps_list, save_file_blob, remove_file, extract_filename, logError

// Browser action
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({url: "about:newtab"});
});

// Handle specific browser behaviors (e.g., for Mac)
if (/mac/i.test(navigator.userAgent)) {
  chrome.webNavigation.onCompleted.addListener((details) => {
    if (!details.url) return;
    if (!/^https?:\/\/www\.google\./.test(details.url)) return;
    if (details.url.includes('/chrome/newtab/')) return;
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["/js/temp/sscr_detect.js"]
    });
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.to === 'bg' && msg.name === "SS_discreteMouseWheel") {
      setStorageData('SS_discrete_mouse_wheel', true);
    }
  });
}

// Server configuration fetching (you may want to move this to a separate module)
(async function () {
  const fetchServerConfig = async () => {
    try {
      const res = await fetchData('https://search.homenewtab.com/conf/conf.php');
      if (!res || res.startsWith('<') && res.includes('permission')) return;
      const conf = JSON.parse(res);
      if (conf.error) return;
      await setStorageData('SRV_conf', res);
      const newInstallTime = +new Date(conf.new_install_time);
      if (newInstallTime) {
        await setStorageData('SRV_conf_new_install_time', newInstallTime);
      }
    } catch (error) {
      console.error('Error fetching server config:', error);
    }
  };

  const installTime = await getStorageData('install_time');
  const srvConfNewInstallTime = await getStorageData('SRV_conf_new_install_time');
  const validInstall = installTime && srvConfNewInstallTime;
  const alreadyNewInstall = installTime < srvConfNewInstallTime;
  if (validInstall && alreadyNewInstall) return;

  const lastFetch = await getStorageData('SRV_conf_last_fetch') || 0;
  if (Date.now() - lastFetch < 12 * 60 * 60 * 1000) return;
  await setStorageData('SRV_conf_last_fetch', Date.now());

  fetchServerConfig();
})();

// Check for uBlock Origin
chrome.management.get('cjpalhdlnbpafiamejdnhcphjbkeiagm', (ext) => {
  if (!chrome.runtime.lastError && ext && ext.enabled) {
    setStorageData('SD_ublock', 'true');
  }
});

// TEMP: fixing issues with disappearing apps
(async function () {
  const iconsOrder = await getStorageData('icons_order') || '';
  const ordered = iconsOrder.split(',');
  for (const id of ordered) {
    const appHtml = await getStorageData(`app_html_${id}`);
    if (appHtml) {
      let updatedHtml = appHtml.replace('visibility: hidden;', '');
      updatedHtml = updatedHtml.replace('test-item pressed', 'test-item');
      if (updatedHtml !== appHtml) {
        await setStorageData(`app_html_${id}`, updatedHtml);
      }
    }
  }
})();

---

convert it to manifest v3, use code above but only for inspiration

Do not change anything that is not related to v3 conversion (leave comments, debug logging, dead code, etc untouched)