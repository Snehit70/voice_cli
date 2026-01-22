import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendHistory, loadHistory, clearHistory, searchHistory, type HistoryItem } from "../../src/utils/history";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as loader from "../../src/config/loader";

describe("History Utility", () => {
  const TEST_DIR = join(tmpdir(), "voice-cli-history-test-" + Math.random().toString(36).slice(2));
  const HISTORY_FILE = join(TEST_DIR, "history.json");

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    
    vi.spyOn(loader, "loadConfig").mockReturnValue({
      apiKeys: { groq: "gsk_123", deepgram: "12345678901234567890123456789012" },
      behavior: { 
        hotkey: "Right Control",
        toggleMode: true,
        notifications: true,
        clipboard: { append: true, minDuration: 0.6, maxDuration: 300 }
      },
      paths: {
        logs: join(TEST_DIR, "logs"),
        history: HISTORY_FILE
      },
      transcription: { language: "en" }
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  it("should return empty array when history file does not exist", () => {
    const history = loadHistory();
    expect(history).toEqual([]);
  });

  it("should append history items correctly", () => {
    const item: HistoryItem = {
      timestamp: new Date().toISOString(),
      text: "Hello world",
      duration: 5,
      engine: "groq",
      processingTime: 500
    };

    appendHistory(item);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(item);
  });

  it("should maintain limit of 1000 items", () => {
    for (let i = 0; i < 1010; i++) {
      appendHistory({
        timestamp: new Date().toISOString(),
        text: `Test ${i}`,
        duration: 1,
        engine: "test",
        processingTime: 100
      });
    }

    const history = loadHistory();
    expect(history).toHaveLength(1000);
    const lastItem = history[history.length - 1];
    expect(lastItem).toBeDefined();
    expect(lastItem?.text).toBe("Test 1009");
  });

  it("should clear history correctly", () => {
    appendHistory({
      timestamp: new Date().toISOString(),
      text: "To be cleared",
      duration: 1,
      engine: "test",
      processingTime: 100
    });

    clearHistory();
    const history = loadHistory();
    expect(history).toEqual([]);
  });

  it("should filter history by keyword", () => {
    appendHistory({
      timestamp: "2026-01-20T10:00:00.000Z",
      text: "Hello world",
      duration: 5,
      engine: "groq",
      processingTime: 500
    });
    appendHistory({
      timestamp: "2026-01-20T11:00:00.000Z",
      text: "Something else",
      duration: 3,
      engine: "deepgram",
      processingTime: 300
    });

    const results = searchHistory({ keyword: "hello" });
    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("Hello world");
  });

  it("should filter history by date", () => {
    appendHistory({
      timestamp: "2026-01-20T10:00:00.000Z",
      text: "Day 20",
      duration: 1,
      engine: "test",
      processingTime: 100
    });
    appendHistory({
      timestamp: "2026-01-21T10:00:00.000Z",
      text: "Day 21",
      duration: 1,
      engine: "test",
      processingTime: 100
    });

    const results = searchHistory({ date: "2026-01-20" });
    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("Day 20");
  });

  it("should filter history by date range", () => {
    appendHistory({
      timestamp: "2026-01-20T10:00:00.000Z",
      text: "Item 1",
      duration: 1,
      engine: "test",
      processingTime: 100
    });
    appendHistory({
      timestamp: "2026-01-21T10:00:00.000Z",
      text: "Item 2",
      duration: 1,
      engine: "test",
      processingTime: 100
    });
    appendHistory({
      timestamp: "2026-01-22T10:00:00.000Z",
      text: "Item 3",
      duration: 1,
      engine: "test",
      processingTime: 100
    });

    const results = searchHistory({ from: "2026-01-20", to: "2026-01-21" });
    expect(results).toHaveLength(2);
    expect(results.some(r => r.text === "Item 1")).toBe(true);
    expect(results.some(r => r.text === "Item 2")).toBe(true);
    expect(results.some(r => r.text === "Item 3")).toBe(false);
  });
});
