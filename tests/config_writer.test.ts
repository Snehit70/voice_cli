import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { saveConfig } from "../src/config/writer";
import { readFileSync, existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type ConfigFile } from "../src/config/schema";

const TEST_DIR = join(tmpdir(), "voice-cli-writer-test-" + Math.random().toString(36).slice(2));
const CONFIG_FILE = join(TEST_DIR, "config.json");

describe("Config Writer", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
        try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
        try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
    }
  });

  test("should write valid config to file", () => {
    const config: ConfigFile = {
      behavior: {
        hotkey: "Ctrl+Space",
      },
    };

    saveConfig(config, CONFIG_FILE);

    expect(existsSync(CONFIG_FILE)).toBe(true);
    const content = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    expect(content.behavior.hotkey).toBe("Ctrl+Space");
    expect(content.behavior.toggleMode).toBe(true); 
  });

  test("should create directory if it does not exist", () => {
    const config: ConfigFile = {};
    saveConfig(config, CONFIG_FILE);
    expect(existsSync(TEST_DIR)).toBe(true);
    expect(existsSync(CONFIG_FILE)).toBe(true);
  });

  test("should set file permissions to 600", () => {
    const config: ConfigFile = {};
    saveConfig(config, CONFIG_FILE);
    const stats = statSync(CONFIG_FILE);
    const mode = stats.mode & 0o777;
    
    expect(mode).toBe(0o600);
  });

  test("should throw error on invalid config", () => {
    const config = {
      behavior: {
        clipboard: {
           minDuration: 0.1
        }
      }
    } as any; 

    expect(() => saveConfig(config, CONFIG_FILE)).toThrow("Config validation failed");
  });
  
  test("should throw error on invalid boost words", () => {
      const words = Array(500).fill("word");
      const config = {
          transcription: {
              boostWords: words
          }
      };
      
      expect(() => saveConfig(config as any, CONFIG_FILE)).toThrow("Boost words limit exceeded");
  });
});
