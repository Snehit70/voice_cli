import { describe, expect, test, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  execOutput: { stdout: "OK", stderr: "" },
  execError: null as Error | null
}));

vi.mock("node:util", () => ({
  promisify: (fn: any) => {
    return async (...args: any[]) => {
      if (mocks.execError) throw mocks.execError;
      return mocks.execOutput;
    };
  },
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock("../src/utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../src/output/notification", () => ({
  notify: vi.fn(),
}));

import { checkHotkeyConflict } from "../src/daemon/conflict";
import { logger } from "../src/utils/logger";
import { notify } from "../src/output/notification";

describe("checkHotkeyConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execOutput.stdout = "OK";
    mocks.execOutput.stderr = "";
    mocks.execError = null;
  });

  test("should return false when python script prints OK", async () => {
    mocks.execOutput.stdout = "OK";
    const result = await checkHotkeyConflict("Ctrl+Space");
    expect(result).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should return true when python script prints CONFLICT", async () => {
    mocks.execOutput.stdout = "CONFLICT";
    const result = await checkHotkeyConflict("Ctrl+Space");
    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  test("should handle invalid hotkeys gracefully", async () => {
    const result = await checkHotkeyConflict("");
    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Could not parse"));
  });

  test("should handle execution errors gracefully", async () => {
    mocks.execError = new Error("Python missing");
    const result = await checkHotkeyConflict("Ctrl+Space");
    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });
});
