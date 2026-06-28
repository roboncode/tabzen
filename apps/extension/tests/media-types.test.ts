import { describe, it, expect } from "vitest";
import {
  classifyDomain,
  classifyMediaType,
  allMediaTypes,
  resolveMediaType,
  includeUrlForCapture,
  BUILT_IN_TYPES,
  OTHER_TYPE,
  type MediaTypeDef,
} from "@/lib/media-types";

const custom: MediaTypeDef[] = [
  { id: "work", label: "Work", color: "#6366f1", builtIn: false },
];

describe("classifyDomain / classifyMediaType", () => {
  it("maps known domains to built-in types", () => {
    expect(classifyDomain("youtube.com", {})).toBe("video");
    expect(classifyDomain("tiktok.com", {})).toBe("video");
    expect(classifyDomain("medium.com", {})).toBe("article");
    expect(classifyDomain("reddit.com", {})).toBe("social");
  });

  it("falls back to 'other' for unknown domains", () => {
    expect(classifyDomain("example.com", {})).toBe("other");
  });

  it("lets overrides win over the built-in map", () => {
    expect(classifyDomain("youtube.com", { "youtube.com": "work" })).toBe("work");
  });

  it("normalizes www. and case", () => {
    expect(classifyDomain("WWW.YouTube.com", {})).toBe("video");
  });

  it("classifyMediaType derives the domain from a URL", () => {
    expect(classifyMediaType("https://www.youtube.com/watch?v=abc", {})).toBe("video");
    expect(classifyMediaType("not a url", {})).toBe("other");
  });
});

describe("allMediaTypes / resolveMediaType", () => {
  it("lists built-ins (minus other) then custom then other last", () => {
    const all = allMediaTypes(custom);
    expect(all[all.length - 1].id).toBe("other");
    expect(all.map((t) => t.id)).toContain("work");
    expect(all.findIndex((t) => t.id === "work")).toBeLessThan(all.length - 1);
  });

  it("resolves a known id, else falls back to OTHER_TYPE", () => {
    expect(resolveMediaType("work", custom).label).toBe("Work");
    expect(resolveMediaType("video", custom).id).toBe("video");
    expect(resolveMediaType("deleted-id", custom)).toEqual(OTHER_TYPE);
  });
});

describe("includeUrlForCapture", () => {
  it("includes everything when captureTypes is empty", () => {
    expect(includeUrlForCapture("https://example.com", [], {})).toBe(true);
  });

  it("includes only urls whose type is selected", () => {
    expect(includeUrlForCapture("https://youtube.com/x", ["video"], {})).toBe(true);
    expect(includeUrlForCapture("https://medium.com/x", ["video"], {})).toBe(false);
  });

  it("respects overrides", () => {
    expect(includeUrlForCapture("https://medium.com/x", ["work"], { "medium.com": "work" })).toBe(true);
  });
});
