import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-solid"],
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
    ],
    host_permissions: [
      "*://*.youtube.com/*",
      "<all_urls>",
    ],
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
