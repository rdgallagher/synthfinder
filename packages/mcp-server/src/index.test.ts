import { describe, it, expect } from "vitest";

describe("workspace wiring", () => {
  it("can import @synthfinder/shared", async () => {
    const shared = await import("@synthfinder/shared");
    expect(shared).toBeDefined();
  });
});
