# Firefox Compatibility Notes

## Summary

This extension was originally built for Chrome (Manifest V3) and has been
minimally adapted so that Firefox can load it as a temporary add-on via
`about:debugging`.

---

## Changes Made

### `manifest.json`
- **`background.service_worker`** → **`background.scripts`**: Firefox MV3 does
  not support service workers for background scripts. Replaced with a `scripts`
  array listing all background scripts in dependency order.
- **`browser_specific_settings.gecko`**: Added with
  `id: homenewtab@local.test` and `strict_min_version: 109.0` (Firefox MV3
  support starts at 109).
- **Removed Chrome-only keys**: `key`, `minimum_chrome_version`, `oauth2`,
  `differential_fingerprint`, `update_url`, `offline_enabled`.
- **Removed Chrome-only permissions**: `chrome://favicon/`, `offscreen`,
  `favicon`, `management`, `identity`.
- **Removed Chrome-only `web_accessible_resources` entry**: the `_favicon/*`
  resource with `extension_ids` (Chrome-only field).

### `js/browser_compat.js` (new file)
Single compatibility shim loaded first in the background scripts array. Stubs
the following Chrome-only APIs so the rest of the codebase runs without errors:

| Stubbed API | Reason |
|---|---|
| `importScripts` | No-op — scripts loaded via manifest `background.scripts` |
| `chrome.offscreen` | Chrome-only; Firefox background has direct DOM/localStorage |
| `chrome.runtime.getContexts` | Chrome 116+; not available in Firefox |
| `chrome.management.*` | Not available in Firefox MV3 |
| `chrome.system.cpu` / `chrome.system.memory` | Not available in Firefox |
| `chrome.action` | Stubbed only if completely absent (Firefox MV3 supports it) |
| `chrome.identity.*` | Google-specific OAuth; stubbed with no-op callbacks |
| `chrome.extension.getBackgroundPage` | Deprecated in MV3; not in Firefox MV3 |
| `chrome.runtime.getBackgroundPage` | Not in Firefox MV3 |
| `chrome.tabs.executeScript` | Removed in MV3; replaced by `scripting` API |

### `js/background/offscreen_setup_bg.js`
- Added a check for native `localStorage` availability. On Firefox (where the
  background is a page, not a worker) `localStorage` is directly available, so
  the Chrome offscreen-document proxy is skipped entirely.

### `js/default_service_worker.js` and `js/default.js`
- Replaced hardcoded `'chrome-extension://' + id` with
  `chrome.runtime.getURL('/')` for cross-browser URL generation.

### `panels/new_app/store/store.js`
- Same `chrome-extension://` → `chrome.runtime.getURL('/')` fix.

### `js/style.js`
- Replaced `chrome-extension://` string in `is_default_or_image_service()` with
  `chrome.runtime.getURL('')`.

---

## Remaining Incompatibilities / Known Issues

### 1. `chrome.management` API (apps grid)
The extension displays Chrome Web Store apps in a grid. `chrome.management` is
not available in Firefox MV3, so the grid will show only the built-in custom
tiles (Facebook, Gmail, eBay, etc.) but not real browser extensions/apps.

### 2. `chrome.identity` / Google Calendar OAuth
Google Calendar integration uses `chrome.identity.getAuthToken()` which is a
Chrome-specific OAuth flow. On Firefox, this would need to use
`browser.identity.launchWebAuthFlow()` with a different OAuth setup.
Currently stubbed with no-op — calendar features will not function.

### 3. `chrome://favicon/` and `_favicon` API
Chrome exposes `chrome://favicon/` and the `_favicon/*` resource for tab
favicons. Firefox has no direct equivalent. The recently-closed-tabs feature
(`js/recently_closed.js`) will show broken favicon images.
**Possible fix**: Use a favicon service like `https://www.google.com/s2/favicons?domain=...`
or Mozilla's built-in favicon handling.

### 4. `chrome://newtab/` URLs
`js/background/default_bg.js` queries for `chrome://newtab/` tabs to refresh
them after an update. On Firefox the equivalent URL is `about:newtab`. This
affects the post-update tab refresh feature only.

### 5. `chrome.extension.getBackgroundPage()` in extension pages
Several UI panels (`panels/options/backup/options.js`,
`panels/new_app/chrome.js`, `js/backup.js`, `js/weather/weather_main.test.js`)
call `chrome.extension.getBackgroundPage()` which returns `null` in Firefox MV3.
These panels may throw errors when accessed.
**Fix**: Migrate to message-passing (`chrome.runtime.sendMessage`) for
background communication, which already works cross-browser.

### 6. `chrome.system.cpu` / `chrome.system.memory`
Used in `js/background/system.js` for memory monitoring and auto-reload.
Stubbed to return safe defaults. The auto-reload-on-high-memory feature is
disabled on Firefox.

### 7. Filesystem API (`filesystem:chrome-extension://...`)
Background image storage uses Chrome's deprecated filesystem API
(`js/background.js`, `js/service_worker.js`, `js/lib/filesystem.js`). Firefox
never supported this API. Custom background images will not persist.
**Possible fix**: Use `IndexedDB` or `chrome.storage.local` for blob storage.

### 8. `chrome.tabs.executeScript` (MV2 API)
Used in a Mac-only smooth-scrolling detection block. This API was removed in
MV3 (for both Chrome and Firefox). The `scripting.executeScript` API should be
used instead. Currently stubbed as no-op.

### 9. Content Security Policy
The CSP includes `frame-src https://*.facebook.com https://*.twitter.com` which
should work in Firefox, but Firefox may be stricter about certain CSP
directives in MV3.

---

## How to Test in Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file from this extension directory
4. A new tab page should appear when opening new tabs
