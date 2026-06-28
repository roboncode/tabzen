import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
  // Dev: don't spawn a throwaway Chromium. `pnpm dev` just builds to
  // .output/chrome-mv3-dev and serves HMR. Load that folder as an unpacked
  // extension in your own Chrome once (chrome://extensions -> Load unpacked);
  // code edits then auto-reload there. WXT pins a stable dev extension ID, so
  // IndexedDB persists across reloads/restarts in your real profile.
  webExt: {
    disabled: true,
  },
  manifest: {
    name: "Tab Zen",
    description: "AI-powered tab organization and management",
    permissions: [
      "tabs",
      "activeTab",
      "storage",
      "sidePanel",
      "contextMenus",
      "identity.email",
      "scripting",
      "bookmarks",
    ],
    host_permissions: [
      "*://*.youtube.com/*",
      "<all_urls>",
    ],
    side_panel: {
      default_path: "index.html",
    },
    commands: {
      _execute_side_panel: {
        suggested_key: { default: "Ctrl+Shift+Z", mac: "Command+Shift+Z" },
        description: "Toggle Tab Zen side panel",
      },
      "capture-all-tabs": {
        suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
        description: "Capture all open tabs",
      },
    },
  },
});
