export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_METADATA") {
        const ogTitle =
          document
            .querySelector('meta[property="og:title"]')
            ?.getAttribute("content") || null;
        const ogDescription =
          document
            .querySelector('meta[property="og:description"]')
            ?.getAttribute("content") || null;
        const ogImage =
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute("content") || null;
        const metaDescription =
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || null;

        sendResponse({
          type: "METADATA",
          ogTitle,
          ogDescription,
          ogImage,
          metaDescription,
        });
      }
      return true;
    });
  },
});
