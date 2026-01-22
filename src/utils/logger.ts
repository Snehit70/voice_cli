import pino from "pino";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { loadConfig } from "../config/loader";

let logDir: string;
try {
  const config = loadConfig();
  logDir = config.paths.logs;
} catch (e) {
  logDir = join(process.env.HOME || ".", ".config", "voice-cli", "logs");
}

if (!existsSync(logDir)) {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch (e) {
    console.error(`Failed to create log directory: ${logDir}`, e);
  }
}

const dateStr = new Date().toISOString().split("T")[0];
const logFile = join(logDir, `voice-cli-${dateStr}.log`);

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    pid: process.pid,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    targets: [
      {
        target: "pino/file",
        options: { destination: logFile, mkdir: true },
      },
      {
        target: "pino-pretty",
        options: { destination: 1, colorize: true },
      },
    ],
  },
});

export const logError = (msg: string, error?: unknown, context?: Record<string, any>) => {
  if (error instanceof Error) {
    logger.error({ err: error, ...context }, msg);
  } else {
    logger.error({ error, ...context }, msg);
  }
};
