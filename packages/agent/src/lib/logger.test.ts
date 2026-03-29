import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs", () => ({
  appendFileSync: vi.fn(),
}));

import { appendFileSync } from "node:fs";
import { createLogger } from "./logger";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('debug (debugEnabled = false) — the privacy guarantee', () => {
    it("does not write to stdout", () => {
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = createLogger("output/test.log", false);

      logger.debug("sensitive: listing description");

      expect(stdoutSpy).not.toHaveBeenCalled();
      stdoutSpy.mockRestore();
    });

    it("does not write to the log file", () => {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = createLogger("output/test.log", false);

      logger.debug("sensitive: listing description");

      expect(appendFileSync).not.toHaveBeenCalled();
    });
  });

  describe("debug (debugEnabled = true) — verifies the feature actually works when enabled", () => {
    it("writes a [DEBUG]-prefixed line to stdout", () => {
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = createLogger("output/test.log", true);

      logger.debug("LLM prompt text");

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("LLM prompt text"));
      stdoutSpy.mockRestore();
    });

    it("appends a [DEBUG]-prefixed line to the log file", () => {
      vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = createLogger("output/test.log", true);

      logger.debug("LLM prompt text");

      expect(appendFileSync).toHaveBeenCalledWith(
        "output/test.log",
        expect.stringContaining("[DEBUG] LLM prompt text")
      );
    });
  });

  describe("log — sanity check that log() always works regardless of debugEnabled", () => {
    it("always writes to stdout", () => {
      const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logger = createLogger("output/test.log", false);

      logger.log("progress message");

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("progress message"));
      expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("[DEBUG]"));
      stdoutSpy.mockRestore();
    });
  });
});
