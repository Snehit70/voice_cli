import { describe, expect, test, mock, beforeEach } from "bun:test";
import { logger } from "../src/utils/logger";
import { notify } from "../src/output/notification";

let mockExecOutput = { stdout: "OK", stderr: "" };
let mockExecError: Error | null = null;

// Mock util.promisify to return a function that returns our mock output
mock.module("node:util", () => ({
  promisify: (fn: any) => {
    return async (...args: any[]) => {
      if (mockExecError) throw mockExecError;
      return mockExecOutput;
    };
  },
}));

mock.module("node:child_process", () => ({
  exec: mock(() => {}),
}));

mock.module("node:fs", () => ({
  writeFileSync: mock(() => {}),
  unlinkSync: mock(() => {}),
}));

mock.module("../src/utils/logger", () => ({
  logger: {
    warn: mock(() => {}),
    debug: mock(() => {}),
    info: mock(() => {}),
    error: mock(() => {}),
  },
}));

mock.module("../src/output/notification", () => ({
  notify: mock(() => {}),
}));

import { checkHotkeyConflict } from "../src/daemon/conflict";

describe("checkHotkeyConflict", () => {
  beforeEach(() => {
    mock.restore();
    mockExecOutput = { stdout: "OK", stderr: "" };
    mockExecError = null;
  });

  test("should return false when python script prints OK", async () => {
    mockExecOutput = { stdout: "OK", stderr: "" };
    const result = await checkHotkeyConflict("Ctrl+Space");
    expect(result).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should return true when python script prints CONFLICT", async () => {
    mockExecOutput = { stdout: "CONFLICT", stderr: "" };
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
    mockExecError = new Error("Python missing");
    const result = await checkHotkeyConflict("Ctrl+Space");
    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalled();
  });
});
