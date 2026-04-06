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

        // Extract creator/channel for social platforms
        let creator: string | null = null;
        const hostname = window.location.hostname.replace("www.", "");

        if (hostname === "youtube.com") {
          // Try multiple YouTube selectors for channel name
          creator =
            (document.querySelector('#channel-name a, #owner #channel-name .ytd-channel-name') as HTMLElement)?.textContent?.trim() ||
            (document.querySelector('span[itemprop="author"] link[itemprop="name"]') as HTMLElement)?.getAttribute("content") ||
            (document.querySelector('.ytd-video-owner-renderer #channel-name') as HTMLElement)?.textContent?.trim() ||
            document.querySelector('meta[itemprop="author"]')?.getAttribute("content") ||
            null;
        } else if (hostname === "instagram.com" || hostname === "threads.net") {
          const match = window.location.pathname.match(/^\/([^/]+)/);
          if (match && !["p", "reel", "stories", "explore", "direct"].includes(match[1])) {
            creator = `@${match[1]}`;
          }
        } else if (hostname === "tiktok.com") {
          const match = window.location.pathname.match(/^\/@([^/]+)/);
          if (match) creator = `@${match[1]}`;
        } else if (hostname === "twitter.com" || hostname === "x.com") {
          const match = window.location.pathname.match(/^\/([^/]+)/);
          if (match && !["home", "explore", "search", "notifications", "messages", "settings", "i"].includes(match[1])) {
            creator = `@${match[1]}`;
          }
        }

        sendResponse({
          type: "METADATA",
          ogTitle,
          ogDescription,
          ogImage,
          metaDescription,
          creator,
        });
      }
      return true;
    });
  },
});
