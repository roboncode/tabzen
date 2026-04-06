export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    browser.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
      if (message.type === "GET_METADATA") {
        // --- Standard OG/meta tags ---
        const ogTitle =
          document.querySelector('meta[property="og:title"]')?.getAttribute("content") || null;
        const ogDescription =
          document.querySelector('meta[property="og:description"]')?.getAttribute("content") || null;
        const ogImage =
          document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;
        const metaDescription =
          document.querySelector('meta[name="description"]')?.getAttribute("content") || null;

        // --- Parse JSON-LD structured data ---
        let creator: string | null = null;
        let publishedAt: string | null = null;

        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) {
              // Extract author/creator
              if (!creator) {
                const author = item.author || item.creator;
                if (author) {
                  if (typeof author === "string") creator = author;
                  else if (Array.isArray(author)) creator = author[0]?.name || author[0];
                  else if (author.name) creator = author.name;
                }
              }
              // Extract publish date
              if (!publishedAt) {
                publishedAt = item.datePublished || item.uploadDate || item.dateCreated || null;
              }
              // Check nested items (e.g. @graph)
              if (item["@graph"]) {
                for (const node of item["@graph"]) {
                  if (!creator) {
                    const author = node.author || node.creator;
                    if (author) {
                      if (typeof author === "string") creator = author;
                      else if (Array.isArray(author)) creator = author[0]?.name || author[0];
                      else if (author.name) creator = author.name;
                    }
                  }
                  if (!publishedAt) {
                    publishedAt = node.datePublished || node.uploadDate || node.dateCreated || null;
                  }
                }
              }
            }
          } catch {}
        }

        // --- Creator avatar extraction ---
        let creatorAvatar: string | null = null;

        // --- YouTube-specific fallback (embedded JSON in script tags) ---
        const hostname = window.location.hostname.replace("www.", "");
        if (hostname === "youtube.com") {
          if (!creator) {
            try {
              const scripts = document.querySelectorAll("script");
              for (const script of scripts) {
                const text = script.textContent || "";
                if (text.includes("ytInitialData") || text.includes("ytInitialPlayerResponse")) {
                  const ownerMatch = text.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
                  if (ownerMatch) { creator = ownerMatch[1]; break; }
                  const authorMatch = text.match(/"author"\s*:\s*"([^"]+)"/);
                  if (authorMatch) { creator = authorMatch[1]; break; }
                }
              }
            } catch {}
          }
          if (!publishedAt) {
            try {
              const scripts = document.querySelectorAll("script");
              for (const script of scripts) {
                const text = script.textContent || "";
                const dateMatch = text.match(/"publishDate"\s*:\s*"([^"]+)"/);
                if (dateMatch) { publishedAt = dateMatch[1]; break; }
              }
            } catch {}
          }
        }

        // --- Channel avatar + URL extraction ---
        let creatorUrl: string | null = null;

        if (hostname === "youtube.com") {
          creatorAvatar =
            (document.querySelector('#owner img.yt-img-shadow, #channel-thumbnail img, ytd-video-owner-renderer img') as HTMLImageElement)?.src || null;

          // Extract channel URL (prefer /channel/ID which is stable)
          const channelLink = document.querySelector('#owner a[href*="/channel/"], #channel-name a[href*="/channel/"], ytd-video-owner-renderer a[href*="/channel/"]') as HTMLAnchorElement;
          if (channelLink?.href) {
            creatorUrl = channelLink.href;
          } else {
            // Try any link to the channel (/@handle)
            const handleLink = document.querySelector('#owner a[href*="/@"], #channel-name a[href*="/@"], ytd-video-owner-renderer a[href*="/@"]') as HTMLAnchorElement;
            if (handleLink?.href) {
              creatorUrl = handleLink.href;
            }
          }

          // Fallback: parse from embedded JSON
          if (!creatorUrl) {
            try {
              const scripts = document.querySelectorAll("script");
              for (const script of scripts) {
                const text = script.textContent || "";
                // Look for channel ID
                const channelIdMatch = text.match(/"channelId"\s*:\s*"(UC[^"]+)"/);
                if (channelIdMatch) {
                  creatorUrl = `https://www.youtube.com/channel/${channelIdMatch[1]}`;
                  break;
                }
                // Or external channel URL
                const extMatch = text.match(/"ownerProfileUrl"\s*:\s*"(https?:\/\/www\.youtube\.com\/[^"]+)"/);
                if (extMatch) {
                  creatorUrl = extMatch[1];
                  break;
                }
              }
            } catch {}
          }
        }
        // Generic: look for author avatar in JSON-LD
        if (!creatorAvatar) {
          for (const script of jsonLdScripts) {
            try {
              const data = JSON.parse(script.textContent || "");
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                const author = item.author;
                if (author?.image?.url) { creatorAvatar = author.image.url; break; }
                if (author?.image) { creatorAvatar = typeof author.image === 'string' ? author.image : null; break; }
              }
            } catch {}
            if (creatorAvatar) break;
          }
        }

        // --- Social platform creators from URL ---
        if (!creator) {
          if (hostname === "instagram.com" || hostname === "threads.net") {
            const match = window.location.pathname.match(/^\/([^/]+)/);
            if (match && !["p", "reel", "stories", "explore", "direct"].includes(match[1])) {
              creator = `@${match[1]}`;
              creatorUrl = `https://www.${hostname}/${match[1]}`;
            }
          } else if (hostname === "tiktok.com") {
            const match = window.location.pathname.match(/^\/@([^/]+)/);
            if (match) {
              creator = `@${match[1]}`;
              creatorUrl = `https://www.tiktok.com/@${match[1]}`;
            }
          } else if (hostname === "twitter.com" || hostname === "x.com") {
            const match = window.location.pathname.match(/^\/([^/]+)/);
            if (match && !["home", "explore", "search", "notifications", "messages", "settings", "i"].includes(match[1])) {
              creator = `@${match[1]}`;
              creatorUrl = `https://x.com/${match[1]}`;
            }
          }
        }

        // --- Generic fallback for publish date ---
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
          creatorAvatar,
          creatorUrl,
          publishedAt,
        });
      }

      return true;
    });
  },
});
