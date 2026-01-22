import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClipboardManager } from "../src/output/clipboard";
import clipboardy from "clipboardy";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";

vi.mock("clipboardy", () => ({
  default: {
    read: vi.fn(),
    write: vi.fn(),
  },
}));


vi.mock("../src/config/loader", () => ({
  loadConfig: vi.fn(() => ({
    behavior: {
      clipboard: {
        append: true,
      },
    },
  })),
}));

vi.mock("../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  logError: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    appendFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

describe("ClipboardManager", () => {
  let manager: ClipboardManager;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAYLAND_DISPLAY = "";
    manager = new ClipboardManager();
  });

  it("should append text to existing content", async () => {
    (clipboardy.read as any).mockResolvedValue("old");
    (clipboardy.write as any).mockResolvedValue(undefined);

    await manager.append("new");

    expect(clipboardy.write).toHaveBeenCalledWith("old\nnew");
  });

  it("should write directly if clipboard is empty", async () => {
    (clipboardy.read as any).mockResolvedValue("");
    (clipboardy.write as any).mockResolvedValue(undefined);

    await manager.append("new");

    expect(clipboardy.write).toHaveBeenCalledWith("new");
  });

  it("should fallback to file if clipboard write fails", async () => {
    (clipboardy.read as any).mockResolvedValue("old");
    (clipboardy.write as any).mockRejectedValue(new Error("clipboard fail"));

    await expect(manager.append("new")).rejects.toThrow("clipboard fail");

    expect(appendFileSync).toHaveBeenCalled();
  });
});
