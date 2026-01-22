import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "../config/loader";
import { logger } from "./logger";

export interface HistoryItem {
  timestamp: string;
  text: string;
  duration: number;
  engine: string;
  processingTime: number;
}

export function appendHistory(item: HistoryItem): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    logger.error("Failed to load config for history append");
    return;
  }

  const historyFile = config.paths.history;

  try {
    const dir = dirname(historyFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let history: HistoryItem[] = [];
    if (existsSync(historyFile)) {
      try {
        const content = readFileSync(historyFile, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          history = parsed;
        } else {
          logger.warn("History file format invalid, resetting to empty array");
        }
      } catch (e) {
        logger.warn("Failed to parse history file, starting fresh");
      }
    }

    history.push(item);

    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    writeFileSync(historyFile, JSON.stringify(history, null, 2), { mode: 0o600 });
  } catch (error) {
    logger.error({ error, historyFile }, "Failed to append to history");
  }
}

export function loadHistory(): HistoryItem[] {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    return [];
  }

  const historyFile = config.paths.history;
  if (!existsSync(historyFile)) {
    return [];
  }

  try {
    const content = readFileSync(historyFile, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error({ error, historyFile }, "Failed to load history");
    return [];
  }
}

export function clearHistory(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    return;
  }

  const historyFile = config.paths.history;
  try {
    if (existsSync(historyFile)) {
      writeFileSync(historyFile, JSON.stringify([], null, 2), { mode: 0o600 });
    }
  } catch (error) {
    logger.error({ error, historyFile }, "Failed to clear history");
  }
}
