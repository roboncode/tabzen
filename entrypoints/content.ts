export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_METADATA") {
        const ogTitle =
          document.querySelector('meta[property="og:title"]')?.getAttribute("content") || null;
        const ogDescription =
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") || null;
        const ogImage =
          document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;
        const metaDescription =
          document.querySelector('meta[name="description"]')?.getAttribute("content") || null;

        const hostname = window.location.hostname.replace("www.", "");
        let creator: string | null = null;
        let publishedAt: string | null = null;

        if (hostname === "youtube.com") {
          // Channel name - try multiple approaches
          creator =
            // Primary: the channel name link in video player
            document.querySelector('#owner #channel-name a, #channel-name #text a, ytd-channel-name a')?.textContent?.trim() ||
            // Structured data
            document.querySelector('span[itemprop="author"] link[itemprop="name"]')?.getAttribute("content") ||
            // Meta tag
            document.querySelector('meta[name="author"]')?.getAttribute("content") ||
            null;

          // If DOM selectors failed, try parsing from page's JSON data
          if (!creator) {
            try {
              const scripts = document.querySelectorAll('script');
              for (const script of scripts) {
                const text = script.textContent || '';
                if (text.includes('ytInitialData') || text.includes('ytInitialPlayerResponse')) {
                  // Look for "author":"ChannelName" pattern
                  const authorMatch = text.match(/"author"\s*:\s*"([^"]+)"/);
                  if (authorMatch) {
                    creator = authorMatch[1];
                    break;
                  }
                  // Also try "ownerChannelName":"ChannelName"
                  const ownerMatch = text.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
                  if (ownerMatch) {
                    creator = ownerMatch[1];
                    break;
                  }
                }
              }
            } catch {}
          }

          // Publish date
          publishedAt =
            document.querySelector('meta[itemprop="datePublished"]')?.getAttribute("content") ||
            document.querySelector('meta[itemprop="uploadDate"]')?.getAttribute("content") ||
            null;

          // Try JSON data for publish date
          if (!publishedAt) {
            try {
              const scripts = document.querySelectorAll('script');
              for (const script of scripts) {
                const text = script.textContent || '';
                if (text.includes('publishDate')) {
                  const dateMatch = text.match(/"publishDate"\s*:\s*"([^"]+)"/);
                  if (dateMatch) {
                    publishedAt = dateMatch[1];
                    break;
                  }
                }
              }
            } catch {}
          }
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

        // Generic publish date fallback
        if (!publishedAt) {
          publishedAt =
            document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
            document.querySelector('meta[name="date"]')?.getAttribute("content") ||
            document.querySelector('time[datetime]')?.getAttribute("datetime") ||
            null;
        }

        sendResponse({
          type: "METADATA",
          ogTitle,
          ogDescription,
          ogImage,
          metaDescription,
          creator,
          publishedAt,
        });
      }
      return true;
    });
  },
});
