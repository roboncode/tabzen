import { describe, it, expect } from "vitest";
import { formatTimestamp, getTimestampUrl } from "@/components/detail/TranscriptView";

describe("formatTimestamp", () => {
  it("formats seconds correctly", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5000)).toBe("0:05");
    expect(formatTimestamp(65000)).toBe("1:05");
    expect(formatTimestamp(3661000)).toBe("1:01:01");
  });
});

describe("getTimestampUrl", () => {
  it("appends time parameter", () => {
    const url = getTimestampUrl("https://www.youtube.com/watch?v=abc123", 65000);
    expect(url).toBe("https://www.youtube.com/watch?v=abc123&t=65s");
  });

  it("replaces existing time parameter", () => {
    const url = getTimestampUrl("https://www.youtube.com/watch?v=abc123&t=10s", 65000);
    expect(url).toBe("https://www.youtube.com/watch?v=abc123&t=65s");
  });
});
