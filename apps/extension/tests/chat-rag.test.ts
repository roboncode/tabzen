import { describe, it, expect } from "vitest";
import type { TranscriptSegment } from "@tab-zen/shared";
import { chunkTranscript, chunkMarkdown } from "@/lib/chat/rag/chunking";
import { cosineSimilarity, findTopK } from "@/lib/chat/rag/vector-store";

function seg(startSeconds: number, text: string): TranscriptSegment {
  return { text, startMs: startSeconds * 1000, durationMs: 5000 };
}

describe("chunkTranscript", () => {
  it("splits a transcript spanning more than the window into multiple chunks", () => {
    const segments: TranscriptSegment[] = [
      seg(0, "intro"),
      seg(30, "thirty"),
      seg(60, "sixty"),
      seg(90, "ninety"),
      seg(130, "after the window"),
      seg(160, "later still"),
    ];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(2);

    expect(chunks[0].position).toBe(0);
    expect(chunks[0].metadata.timestampStart).toBe("0:00");
    expect(chunks[0].metadata.timestampEnd).toBe("1:30");
    expect(chunks[0].text).toBe("intro thirty sixty ninety");

    expect(chunks[1].position).toBe(1);
    expect(chunks[1].metadata.timestampStart).toBe("2:10");
    expect(chunks[1].metadata.timestampEnd).toBe("2:40");
    expect(chunks[1].text).toBe("after the window later still");
  });

  it("returns a single chunk for a short transcript", () => {
    const segments: TranscriptSegment[] = [seg(0, "a"), seg(30, "b"), seg(60, "c")];

    const chunks = chunkTranscript(segments);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.timestampStart).toBe("0:00");
    expect(chunks[0].metadata.timestampEnd).toBe("1:00");
    expect(chunks[0].text).toBe("a b c");
  });

  it("respects a custom window size", () => {
    const segments: TranscriptSegment[] = [seg(0, "a"), seg(45, "b"), seg(100, "c")];

    const chunks = chunkTranscript(segments, { windowSeconds: 30 });

    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("chunkMarkdown", () => {
  it("creates one chunk per H1-H3 section with sectionHeading metadata", () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "## Section A",
      "",
      "Content A.",
      "",
      "### Section B",
      "",
      "Content B.",
    ].join("\n");

    const chunks = chunkMarkdown(md);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.metadata.sectionHeading)).toEqual([
      "Title",
      "Section A",
      "Section B",
    ]);
    expect(chunks[0].text.startsWith("Title")).toBe(true);
    expect(chunks[1].text).toContain("Content A.");
    expect(chunks[2].text).toContain("Content B.");
  });

  it("falls back to paragraph-group chunks when there are no headings", () => {
    const paragraphs = ["p1", "p2", "p3", "p4"];
    const md = paragraphs.join("\n\n");

    const chunks = chunkMarkdown(md);

    // chunkSize = 3 → 4 paragraphs split into 2 groups
    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.sectionHeading).toBeUndefined();
    expect(chunks[0].text).toBe("p1\n\np2\n\np3");
    expect(chunks[1].text).toBe("p4");
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 when one vector is all zeros", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("findTopK", () => {
  it("returns the top k entries sorted by score descending", () => {
    const query = [1, 0, 0];
    const entries = [
      { id: "a", embedding: [1, 0, 0] },
      { id: "b", embedding: [0.5, 0.5, 0] },
      { id: "c", embedding: [0, 1, 0] },
      { id: "d", embedding: [0, 0, 1] },
    ];

    const result = findTopK(query, entries, 2);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    expect(result[0].score).toBeCloseTo(1);
  });
});
