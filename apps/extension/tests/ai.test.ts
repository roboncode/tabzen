import { describe, it, expect } from "vitest";
import { parseBookmarkAssignments } from "@/lib/ai";

// ---------------------------------------------------------------------------
// parseBookmarkAssignments
// ---------------------------------------------------------------------------

describe("parseBookmarkAssignments", () => {
  it("valid JSON with assignments → correct TabFolderAssignment[]", () => {
    const content = JSON.stringify({
      assignments: [
        { url: "https://youtube.com/watch?v=1", folder: "Video" },
        { url: "https://github.com/org/repo", folder: "Development" },
      ],
    });

    const result = parseBookmarkAssignments(content);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ url: "https://youtube.com/watch?v=1", folder: "Video" });
    expect(result[1]).toEqual({ url: "https://github.com/org/repo", folder: "Development" });
  });

  it("invalid JSON → throws", () => {
    expect(() => parseBookmarkAssignments("not valid json {{")).toThrow();
  });

  it("JSON that is valid but not an object → throws", () => {
    expect(() => parseBookmarkAssignments("[1,2,3]")).toThrow();
  });

  it("response missing some tabs → only present assignments returned", () => {
    // Three tabs were sent but AI only returned two
    const content = JSON.stringify({
      assignments: [
        { url: "https://youtube.com/watch?v=1", folder: "Video" },
        // url u2 is omitted by the AI
        { url: "https://example.com/article", folder: "Articles" },
      ],
    });

    const result = parseBookmarkAssignments(content);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.url)).not.toContain("https://missing.com");
  });

  it("malformed entry missing folder → dropped, valid entries kept", () => {
    const content = JSON.stringify({
      assignments: [
        { url: "https://youtube.com/watch?v=1", folder: "Video" },
        { url: "https://bad-entry.com" }, // missing folder
        { url: "https://github.com/repo", folder: "Development" },
      ],
    });

    const result = parseBookmarkAssignments(content);

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe("https://youtube.com/watch?v=1");
    expect(result[1].url).toBe("https://github.com/repo");
  });

  it("malformed entry missing url → dropped, valid entries kept", () => {
    const content = JSON.stringify({
      assignments: [
        { url: "https://youtube.com/watch?v=1", folder: "Video" },
        { folder: "Orphan" }, // missing url
      ],
    });

    const result = parseBookmarkAssignments(content);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://youtube.com/watch?v=1");
  });

  it("empty assignments array → empty result", () => {
    const content = JSON.stringify({ assignments: [] });
    const result = parseBookmarkAssignments(content);
    expect(result).toHaveLength(0);
  });

  it("non-string url or folder → dropped", () => {
    const content = JSON.stringify({
      assignments: [
        { url: 42, folder: "Video" }, // url is not a string
        { url: "https://example.com", folder: true }, // folder is not a string
        { url: "https://valid.com", folder: "Good" },
      ],
    });

    const result = parseBookmarkAssignments(content);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://valid.com");
  });

  it("missing assignments key → throws", () => {
    const content = JSON.stringify({ groups: [] });
    expect(() => parseBookmarkAssignments(content)).toThrow();
  });
});
