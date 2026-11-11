import { describe, expect, it } from "vitest";
import { classifyStory } from "@/lib/news/classify";

describe("classifyStory", () => {
  it("flags AI headlines", () => {
    expect(classifyStory("OpenAI launches a new ChatGPT model", "", "International")).toBe(
      "Intelligence artificielle",
    );
  });

  it("flags Quebec geography", () => {
    expect(classifyStory("Montréal adopte un règlement municipal", "", "Canada")).toBe("Québec");
  });

  it("falls back to the source default", () => {
    expect(classifyStory("Routine diplomatic talks conclude", "", "Économie")).toBe("Économie");
  });
});
