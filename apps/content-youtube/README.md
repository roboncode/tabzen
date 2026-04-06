# YouTube Scraper API

A YouTube scraper API built with Hono that provides endpoints to fetch channel, video, and transcript information. Designed with a two-tier fallback system for flexibility and cost-effectiveness.

## Features

- 🎯 **Two-tier fallback system**: YouTube Data API → RSS Feed
- 📹 **Complete Data**: Channels, videos, transcripts, and engagement metrics
- 🚀 **No API Key Required**: Basic functionality works without any API keys
- ⚡ **Enhanced Mode**: Optional YouTube Data API integration for advanced features
- 🔄 **Pagination Support**: Navigate through large video collections (with API key)
- 📊 **Advanced Filtering**: Date-based filtering and custom result limits

## Data Source Hierarchy

The scraper uses a two-tier fallback system:

### 1. YouTube Data API (Recommended - Requires API Key)

- **Full Features**: Pagination, advanced filtering, and unlimited video access
- **Better Data**: Access to view counts, like counts, and detailed metadata
- **Date Filtering**: Filter videos by publication date (RFC 3339 format)
- **Flexible Pagination**: Custom result limits (1-50 per page)
- **Video Duration**: Optional duration information
- **Rate Limits**: 10,000 quota units per day (free tier)

### 2. RSS Feed (Free - No API Key)

- **Good Reliability**: Uses YouTube's official RSS feed
- **Recent Videos**: Access to ~15 most recent videos per channel
- **No Quotas**: Unlimited requests, no API key needed
- **Basic Data**: Title, description, thumbnail, publish date
- **Limited Features**: No pagination, filtering, or advanced metadata

## Quick Start

### Installation

```bash
npm install
# or
pnpm install
```

### Configuration

Create a `.env` file:

```env
PORT=5150
YOUTUBE_API_KEY=your_api_key_here  # Optional but recommended for advanced features
```

**Get a YouTube API Key:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project
- Enable YouTube Data API v3
- Create credentials (API Key)
- Free tier: 10,000 quota units per day

### Run the Server

```bash
npm run dev
# or
pnpm dev
```

Server will start at `http://localhost:5150`

## API Endpoints

### Feature Comparison

| Endpoint | Without YouTube API | With YouTube API |
|----------|---------------------|------------------|
| Channel Info | ✅ Full data | ✅ Full data |
| Recent Videos | ✅ ~15 videos (RSS) | ✅ ~15 videos (RSS) |
| All Videos | ❌ Not available | ✅ Unlimited with pagination |
| Video Details | ✅ Full data | ✅ Full data |
| Transcripts | ✅ Available | ✅ Available |
| Date Filtering | ❌ Not available | ✅ Available |
| Video Duration | ❌ Not available | ✅ Optional |

---

### 1. GET `/handle?handle=<handle>`
**Resolve Channel ID**

Converts various YouTube handle formats to a clean channel ID.

**Query Parameters:**
- `handle` (required): YouTube handle (@username), username, URL, or channel ID

**Examples:**
```bash
curl "http://localhost:5150/handle?handle=@fabio-bergmann"
curl "http://localhost:5150/handle?handle=https://www.youtube.com/@fabio-bergmann"
curl "http://localhost:5150/handle?handle=UCxxxxxxxxxxxxxxxxxx"
```

**Response:**
```json
{
  "channelId": "UCxxxxxxxxxxxxxxxxxx"
}
```

---

### 2. GET `/profile?handle=<handle>`
**Get Channel Information**

Retrieves detailed channel information including name, handle, description, and thumbnail.

**Query Parameters:**
- `handle`: Channel ID, handle (@username), or URL (will be resolved automatically)

**Examples:**
```bash
curl "http://localhost:5150/profile?handle=UCxxxxxxxxxxxxxxxxxx"
curl "http://localhost:5150/profile?handle=@fabio-bergmann"
curl "http://localhost:5150/profile?handle=https://www.youtube.com/@fabio-bergmann"
```

**Response:**
```json
{
  "id": "UCxxxxxxxxxxxxxxxxxx",
  "name": "Fabio Bergmann",
  "url": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx",
  "handle": "@fabio-bergmann",
  "description": "Welcome to my channel where I share...",
  "thumbnail": "https://yt3.googleusercontent.com/..."
}
```

**Data Sources:**
- ✅ YouTube Data API (if configured)
- ✅ RSS Feed + HTML scraping

---

### 3. GET `/videos/recent?handle=<handle>`
**Get Recent Videos (RSS)**

Fetches the most recent ~15 videos from a channel using YouTube's RSS feed. No API key required.

**Query Parameters:**
- `handle` (required): YouTube handle, username, URL, or channel ID

**Examples:**
```bash
curl "http://localhost:5150/videos/recent?handle=@fabio-bergmann"
curl "http://localhost:5150/videos/recent?handle=UCxxxxxxxxxxxxxxxxxx"
```

**Response:**
```json
{
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "How to Build Amazing Apps",
      "description": "In this video, I'll show you...",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "published": "2024-01-15T10:30:00Z",
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "channelId": "UCxxxxxxxxxxxxxxxxxx",
      "channelName": "Fabio Bergmann",
      "channelUrl": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx"
    }
  ],
  "pageInfo": {
    "resultsPerPage": 15
  }
}
```

**Data Sources:**
- ✅ RSS Feed (always used for this endpoint)

---

### 4. GET `/videos?handle=<handle>&...`
**Get Videos (Paginated with YouTube API)**

Fetches videos from a channel with pagination support and advanced filtering. Requires YouTube API key.

**Query Parameters:**
- `handle` (required): YouTube handle, username, URL, or channel ID
- `maxResults` (optional): Number of results per page (1-50, default: 25)
- `pageToken` (optional): Token for pagination (from `nextPageToken` or `prevPageToken`)
- `publishedAfter` (optional): RFC 3339 timestamp - only return videos published after this date
- `publishedBefore` (optional): RFC 3339 timestamp - only return videos published before this date
- `includeDuration` (optional): Set to `true` to include video duration (requires additional API calls)

**Examples:**
```bash
# Basic usage
curl "http://localhost:5150/videos?handle=@fabio-bergmann"

# Custom result limit
curl "http://localhost:5150/videos?handle=@fabio-bergmann&maxResults=10"

# Date filtering
curl "http://localhost:5150/videos?handle=@fabio-bergmann&publishedAfter=2024-01-01T00:00:00Z"

# Pagination
curl "http://localhost:5150/videos?handle=@fabio-bergmann&pageToken=CAUQAA&maxResults=25"

# Include video duration
curl "http://localhost:5150/videos?handle=@fabio-bergmann&includeDuration=true"

# Combined filters
curl "http://localhost:5150/videos?handle=@fabio-bergmann&maxResults=50&publishedAfter=2024-01-01T00:00:00Z&publishedBefore=2024-12-31T23:59:59Z"
```

**Response:**
```json
{
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "How to Build Amazing Apps",
      "description": "In this video, I'll show you how to build amazing applications using...",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "published": "2024-01-15T10:30:00Z",
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "channelId": "UCxxxxxxxxxxxxxxxxxx",
      "channelName": "Fabio Bergmann",
      "channelUrl": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxx",
      "duration": "PT15M30S",
      "tags": ["programming", "tutorial", "javascript"]
    }
  ],
  "pageInfo": {
    "totalResults": 500,
    "resultsPerPage": 25
  },
  "nextPageToken": "CAUQAA",
  "prevPageToken": "CAUQAQ"
}
```

**Data Sources:**
- ✅ YouTube Data API only (requires API key)
- ❌ Returns error if no API key configured

**Note:** The `duration` field is only included if `includeDuration=true`. Duration uses ISO 8601 format (e.g., `PT15M30S` = 15 minutes 30 seconds).

---

### 5. GET `/videos/:id`
**Get Video Details**

Retrieves detailed information about a specific video including title, description, views, and likes.

**Path Parameters:**
- `id`: YouTube video ID

**Examples:**
```bash
curl "http://localhost:5150/videos/dQw4w9WgXcQ"
curl "http://localhost:5150/videos/jNQXAC9IVRw"
```

**Response:**
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "How to Build Amazing Apps",
  "description": "In this comprehensive tutorial, I'll walk you through building amazing applications...",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "published": "2024-01-15T10:30:00Z",
  "length": "15:30",
  "channelId": "UCxxxxxxxxxxxxxxxxxx",
  "channelName": "Fabio Bergmann",
  "channelHandle": "@fabio-bergmann",
  "viewCount": "1000000",
  "likeCount": "50000",
  "tags": ["programming", "tutorial", "javascript"]
}
```

**Data Sources:**
- ✅ HTML scraping (always works)
- ✅ YouTube Data API (if configured, provides more accurate data)

---

### 6. GET `/videos/:id/transcript`
**Get Video Transcript**

Retrieves the transcript/captions for a specific video if available.

**Path Parameters:**
- `id`: YouTube video ID

**Examples:**
```bash
curl "http://localhost:5150/videos/dQw4w9WgXcQ/transcript"
curl "http://localhost:5150/videos/jNQXAC9IVRw/transcript"
```

**Response:**
```json
{
  "transcript": [
    {
      "start": 0.0,
      "duration": 2.5,
      "text": "Hello and welcome to this tutorial"
    },
    {
      "start": 2.5,
      "duration": 3.0,
      "text": "In this video, we'll explore how to build amazing apps"
    },
    {
      "start": 5.5,
      "duration": 2.8,
      "text": "Let's get started with the basics"
    }
  ]
}
```

**Error Response (No Transcript):**
```json
{
  "error": "No transcript available for this video"
}
```

**Data Sources:**
- ✅ YouTube transcript API (via youtube-transcript package)

**Note:** Not all videos have transcripts. Auto-generated captions are included when available.

---

## Environment Variables

```env
# Server Configuration
PORT=5150                           # Server port (default: 5150)

# YouTube Data API Configuration (Optional but Recommended)
YOUTUBE_API_KEY=your_api_key_here   # Get from Google Cloud Console
```

---

## Production Recommendations

### Without YouTube API Key (Free Tier)

✅ **Good for:**
- Personal projects
- Low-volume applications
- Recent video tracking (~15 videos)
- Testing and development

⚠️ **Limitations:**
- No pagination for videos
- Limited to ~15 recent videos per channel
- No date-based filtering
- No video duration information

**Recommendations:**
- Use `/videos/recent` endpoint for recent videos
- Cache channel and video information
- Implement request delays to be respectful

### With YouTube API Key (Production)

✅ **Good for:**
- Production applications
- High-volume data access
- Advanced filtering requirements
- Comprehensive video catalogs

✅ **Benefits:**
- Full pagination support
- Date-based filtering
- Access to all channel videos
- Video duration information
- Official YouTube support

**Recommendations:**
- Monitor quota usage (10,000 units/day free tier)
- Implement caching to reduce API calls
- Use pagination efficiently
- Consider upgrading quota if needed

**API Quota Costs:**
- Channel info: 1 unit
- Video list: 1 unit
- Video details: 1 unit
- Transcript: 0 units (free)

---

## Error Handling

The API returns standard HTTP status codes:

- `200 OK`: Successful request
- `400 Bad Request`: Missing or invalid parameters
- `404 Not Found`: Resource not found (e.g., channel doesn't exist)
- `500 Internal Server Error`: Server error or scraping failure

**Error Response Format:**
```json
{
  "error": "Failed to get channel info",
  "details": "Channel not found"
}
```

---

## Rate Limiting

### Without YouTube API Key
- RSS feeds have no official rate limits
- Be respectful with request frequency
- Recommended: 1 request per second

### With YouTube API Key
- Free tier: 10,000 quota units per day
- Paid tier: Up to 1,000,000+ units per day
- Quota resets daily at midnight Pacific Time

**Quota Management Tips:**
- Cache channel information (changes infrequently)
- Use RSS endpoint for recent videos when possible
- Only request duration when needed (`includeDuration=false`)
- Implement pagination to avoid fetching all videos at once

---

## Legal & Ethical Considerations

⚠️ **Important:**
- This tool is for educational and research purposes
- Respect YouTube's Terms of Service
- Implement appropriate rate limiting
- Do not use for spam or policy violations
- Consider YouTube's official API for commercial use
- Always comply with data privacy regulations (GDPR, CCPA, etc.)

**Recommended Use Cases:**
- Personal video archiving
- Research and analytics
- Content backup
- Educational projects
- Video metadata analysis

**Not Recommended:**
- Violating content creators' rights
- Downloading copyrighted content without permission
- Automated spam or abuse
- Commercial scraping without proper licensing

---

## Troubleshooting

### "Unable to resolve channel ID"
- Check if the channel exists and is public
- Try using the exact channel ID (starts with UC...)
- Verify the handle format (@username)
- Some channels may not have public handles

### Empty results for videos
- Channel may have no videos
- Rate limiting may be in effect
- For `/videos` endpoint: verify YouTube API key is configured
- Try using `/videos/recent` instead

### Transcript returns 404
- Not all videos have transcripts
- Auto-generated captions may not be available
- Check if captions are disabled by creator
- Some videos may have region-specific caption restrictions

### YouTube API quota exceeded
- Free tier has 10,000 units per day
- Quota resets at midnight Pacific Time
- Implement caching to reduce API calls
- Consider upgrading quota or using RSS endpoints

### "Failed to get video info"
- Video may be private or deleted
- Video ID may be incorrect
- Age-restricted videos may have limited data
- Try accessing the video URL directly to verify

---

## Development

### Project Structure
```
youtube-scraper/
├── src/
│   ├── index.ts                 # Main API server
│   ├── YouTubeService.ts        # Core scraping logic
│   ├── YouTubeResolver.ts       # Channel ID resolution
│   ├── models.ts                # TypeScript interfaces
│   └── env.ts                   # Environment configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Tech Stack
- **Framework**: Hono (lightweight web framework)
- **Runtime**: Node.js with TypeScript
- **YouTube API**: @googleapis/youtube
- **Transcripts**: youtube-transcript
- **RSS Parsing**: rss-parser
- **HTML Scraping**: youtube-extractor
- **Validation**: Zod
- **Environment**: @t3-oss/env-core

---

## License

MIT

---

## Support

For issues, questions, or feature requests:
- Check the troubleshooting section above
- Review YouTube Data API documentation: https://developers.google.com/youtube/v3
- Compare with the Instagram scraper implementation

---

## Changelog

### v1.0.0 (Current)
- ✅ Initial release
- ✅ Channel information endpoints
- ✅ Recent videos via RSS feed
- ✅ Paginated videos via YouTube Data API
- ✅ Video details and metadata
- ✅ Transcript/caption support
- ✅ Advanced filtering (date ranges, custom limits)
- ✅ Optional video duration
- ✅ Two-tier fallback system
- ✅ Enhanced health check and logging
