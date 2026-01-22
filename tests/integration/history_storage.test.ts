import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendHistory, loadHistory, clearHistory, type HistoryItem } from "../../src/utils/history";
import { existsSync, mkdirSync, rmSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as loader from "../../src/config/loader";

describe("History Storage Integration", () => {
  const TEST_DIR = join(tmpdir(), "voice-cli-history-integration-" + Math.random().toString(36).slice(2));
  const HISTORY_FILE = join(TEST_DIR, "history.json");

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    
    vi.spyOn(loader, "loadConfig").mockReturnValue({
      paths: {
        history: HISTORY_FILE
      }
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should persist history items to disk", () => {
    const item: HistoryItem = {
      timestamp: new Date().toISOString(),
      text: "Integration test message",
      duration: 2.5,
      engine: "groq",
      processingTime: 450
    };

    appendHistory(item);

    expect(existsSync(HISTORY_FILE)).toBe(true);

    const content = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    expect(content).toHaveLength(1);
    expect(content[0]).toEqual(item);

    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(item);
  });

  it("should set correct file permissions (600)", () => {
    const item: HistoryItem = {
      timestamp: new Date().toISOString(),
      text: "Permission test",
      duration: 1,
      engine: "test",
      processingTime: 100
    };

    appendHistory(item);

    const stats = statSync(HISTORY_FILE);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("should handle directory creation if it does not exist", () => {
    const nestedDir = join(TEST_DIR, "deep", "nested", "dir");
    const nestedFile = join(nestedDir, "history.json");
    
    vi.spyOn(loader, "loadConfig").mockReturnValue({
      paths: {
        history: nestedFile
      }
    } as any);

    const item: HistoryItem = {
      timestamp: new Date().toISOString(),
      text: "Nested path test",
      duration: 1,
      engine: "test",
      processingTime: 100
    };

    appendHistory(item);

    expect(existsSync(nestedFile)).toBe(true);
    expect(loadHistory()).toHaveLength(1);
  });

  it("should enforce the 1000 item limit across multiple appends", () => {
    for (let i = 0; i < 1050; i++) {
      appendHistory({
        timestamp: new Date().toISOString(),
        text: `Message ${i}`,
        duration: 1,
        engine: "test",
        processingTime: 10
      });
    }

    const history = loadHistory();
    expect(history).toHaveLength(1000);
    
    expect(history[0]?.text).toBe("Message 50");
    expect(history[999]?.text).toBe("Message 1049");
    
    const onDisk = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    expect(onDisk).toHaveLength(1000);
    expect(onDisk[0].text).toBe("Message 50");
  });

  it("should clear history from disk", () => {
    appendHistory({
      timestamp: new Date().toISOString(),
      text: "Temp message",
      duration: 1,
      engine: "test",
      processingTime: 10
    });

    expect(existsSync(HISTORY_FILE)).toBe(true);
    
    clearHistory();
    
    const loaded = loadHistory();
    expect(loaded).toEqual([]);
    
    const onDisk = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
    expect(onDisk).toEqual([]);
  });

  it("should recover from corrupted history file", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    require("node:fs").writeFileSync(HISTORY_FILE, "invalid json { {");
    
    const item: HistoryItem = {
      timestamp: new Date().toISOString(),
      text: "Recovery test",
      duration: 1,
      engine: "test",
      processingTime: 100
    };
    
    appendHistory(item);
    
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.text).toBe("Recovery test");
  });
});
