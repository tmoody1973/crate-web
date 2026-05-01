import { describe, it, expect } from "vitest";
import { slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Sampa The Great")).toBe("sampa-the-great");
  });

  it("handles ampersands", () => {
    expect(slugify("DOMi & JD BECK")).toBe("domi-jd-beck");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("  Khruangbin  ")).toBe("khruangbin");
  });

  it("collapses consecutive special chars to single hyphen", () => {
    expect(slugify("MF...DOOM!!!")).toBe("mf-doom");
  });

  it("handles single word", () => {
    expect(slugify("Thundercat")).toBe("thundercat");
  });

  it("handles already-slugified input", () => {
    expect(slugify("fela-kuti")).toBe("fela-kuti");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles numbers", () => {
    expect(slugify("88rising")).toBe("88rising");
  });

  it("handles unicode by stripping non-ascii", () => {
    expect(slugify("Björk")).toBe("bj-rk");
  });
});
