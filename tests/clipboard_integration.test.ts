import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClipboardManager } from "../src/output/clipboard";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TEST_CONFIG_DIR = join(homedir(), ".config", "voice-cli-test");
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, "config.json");

vi.mock("../src/config/loader", async () => {
  const actual = await vi.importActual<typeof import("../src/config/loader")>("../src/config/loader");
  return {
    ...actual,
    loadConfig: (path?: string) => actual.loadConfig(path || TEST_CONFIG_FILE),
  };
});

describe("ClipboardManager Integration", () => {
  let manager: ClipboardManager;
  let originalContent: string;

  beforeEach(async () => {
    if (!existsSync(TEST_CONFIG_DIR)) {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }

    const testConfig = {
      apiKeys: { 
        groq: "gsk_test_long_enough", 
        deepgram: "00000000-0000-0000-0000-000000000000" 
      },
      behavior: {
        clipboard: {
          append: true,
          minDuration: 0.6,
          maxDuration: 300
        }
      },
      paths: {
        logs: "~/.config/voice-cli-test/logs",
        history: "~/.config/voice-cli-test/history.json"
      }
    };
    writeFileSync(TEST_CONFIG_FILE, JSON.stringify(testConfig), { mode: 0o600 });

    manager = new ClipboardManager();
    
    try {
      originalContent = await (manager as any).read();
    } catch (e) {
      originalContent = "";
    }
  });

  afterEach(async () => {
    try {
      await (manager as any).write(originalContent);
    } catch (e) {
    }
    
    if (existsSync(TEST_CONFIG_FILE)) {
      unlinkSync(TEST_CONFIG_FILE);
    }
  });

  it("verifies clipboard append mode (integration)", async () => {
    const firstText = `Test Line 1 (${Date.now()})`;
    const secondText = `Test Line 2 (${Date.now()})`;

    await (manager as any).write(firstText);
    const initialRead = await (manager as any).read();
    expect(initialRead).toBe(firstText);

    await manager.append(secondText);

    const finalRead = await (manager as any).read();
    expect(finalRead).toBe(`${firstText}\n${secondText}`);
  });

  it("verifies append mode can be disabled via config", async () => {
    writeFileSync(TEST_CONFIG_FILE, JSON.stringify({
      apiKeys: { 
        groq: "gsk_test_long_enough", 
        deepgram: "00000000-0000-0000-0000-000000000000" 
      },
      behavior: {
        clipboard: {
          append: false,
          minDuration: 0.6,
          maxDuration: 300
        }
      },
      paths: {
        logs: "~/.config/voice-cli-test/logs",
        history: "~/.config/voice-cli-test/history.json"
      }
    }), { mode: 0o600 });

    const firstText = "First";
    const secondText = "Second";

    await (manager as any).write(firstText);
    await manager.append(secondText);

    const finalRead = await (manager as any).read();
    expect(finalRead).toBe(secondText);
  });
});
