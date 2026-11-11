import { describe, expect, it } from "vitest";
import { redactUrl, validateHttpUrl } from "@/lib/security/urls";

describe("validateHttpUrl", () => {
  it("accepts https feeds", () => {
    const r = validateHttpUrl("https://feeds.bbci.co.uk/news/rss.xml");
    expect(r.ok).toBe(true);
  });

  it("rejects file and javascript URLs", () => {
    expect(validateHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateHttpUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects credentials in the URL", () => {
    expect(validateHttpUrl("https://user:secret@example.com/feed").ok).toBe(false);
  });

  it("redacts userinfo if present", () => {
    expect(redactUrl("https://user:pass@example.com/x")).not.toContain("pass");
  });
});
