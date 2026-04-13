# Content Compression

Compress the following document content for use as AI chat context. Your goal is to reduce token usage by 50-70% while preserving ALL factual substance.

## Rules

- Drop: articles (a/an/the), filler words (just, really, basically, actually, simply, essentially), hedging (I think, sort of, kind of, perhaps), pleasantries, redundant phrasing
- Keep: all technical terms exact, all names/dates/numbers/URLs exact, all facts and claims, causal relationships, key quotes
- Use short synonyms (big not extensive, fix not "implement a solution for", show not demonstrate)
- Fragments OK — no need for complete sentences
- Preserve section structure if present (headings, lists)
- For transcripts: merge overlapping/repeated points, drop verbal filler (um, uh, you know, like), collapse stutters
- For articles: preserve paragraph breaks as single line breaks
- Do NOT add commentary, interpretation, or new information
- Do NOT use abbreviations that aren't in the original

## Format

Return ONLY the compressed content. No preamble, no explanation, no wrapper text.

## Content to compress

{{content}}
