import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Daemon Lifecycle Integration", () => {
  const testHome = join(tmpdir(), `voice-cli-test-home-${Date.now()}`);
  const configDir = join(testHome, ".config", "voice-cli");
  const pidFile = join(configDir, "daemon.pid");
  const configFile = join(configDir, "config.json");

  beforeEach(() => {
    if (existsSync(testHome)) {
      rmSync(testHome, { recursive: true, force: true });
    }
    mkdirSync(configDir, { recursive: true });
    
    const testConfig = {
      apiKeys: {
        groq: "gsk_test_12345678901234567890",
        deepgram: "00000000-0000-0000-0000-000000000000"
      },
      behavior: {
        hotkey: "RIGHT CONTROL",
        audioDevice: "default",
        clipboard: { append: true, minDuration: 0.6, maxDuration: 300 }
      },
      paths: {
        logs: "~/.config/voice-cli/logs",
        history: "~/.config/voice-cli/history.json"
      },
      transcription: {
        language: "en",
        boostWords: []
      }
    };
    writeFileSync(configFile, JSON.stringify(testConfig), { mode: 0o600 });
  });

  afterEach(() => {
    try {
      execSync(`HOME=${testHome} bun run index.ts stop`, {
        env: { ...process.env, HOME: testHome },
        stdio: "ignore"
      });
    } catch (e) {}

    if (existsSync(pidFile)) {
      try {
        const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
        process.kill(pid, "SIGKILL");
      } catch (e) {}
    }

    rmSync(testHome, { recursive: true, force: true });
  });

  const runCLI = (args: string[]) => {
    return execSync(`HOME=${testHome} bun run index.ts ${args.join(" ")}`, {
      encoding: "utf-8",
      env: { ...process.env, HOME: testHome }
    });
  };

  it("should start directly, report status, and stop the daemon", async () => {
    const daemonProcess = spawn("bun", ["run", "index.ts", "start", "--no-supervisor"], {
      env: { ...process.env, HOME: testHome },
      stdio: "pipe"
    });

    let attempts = 0;
    while (!existsSync(pidFile) && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    expect(existsSync(pidFile), "PID file should exist after start").toBe(true);
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    expect(pid).toBeGreaterThan(0);

    const statusOutput = runCLI(["status"]);
    expect(statusOutput).toContain("Running");
    expect(statusOutput).toContain(`PID: ${pid}`);

    runCLI(["stop"]);
    
    attempts = 0;
    while (existsSync(pidFile) && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    expect(existsSync(pidFile), "PID file should be removed after stop").toBe(false);

    const statusOutputStopped = runCLI(["status"]);
    expect(statusOutputStopped).toContain("Stopped");
    
    daemonProcess.kill("SIGKILL");
  }, 15000);

  it("should restart the daemon", async () => {


    const initialDaemon = spawn("bun", ["run", "index.ts", "start", "--no-supervisor"], {
      env: { ...process.env, HOME: testHome },
      stdio: "ignore"
    });

    let attempts = 0;
    while (!existsSync(pidFile) && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    expect(existsSync(pidFile)).toBe(true);
    const initialPid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);

    const restartProcess = spawn("bun", ["run", "index.ts", "restart"], {
      env: { ...process.env, HOME: testHome },
      stdio: "ignore"
    });
    
    attempts = 0;
    let disappeared = false;
    while (attempts < 20) {
      if (!existsSync(pidFile)) {
        disappeared = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    expect(disappeared, "PID file should have disappeared during restart").toBe(true);

    attempts = 0;
    let newPid = 0;
    while (attempts < 60) {
      if (existsSync(pidFile)) {
        try {
          const content = readFileSync(pidFile, "utf-8").trim();
          newPid = parseInt(content, 10);
          if (newPid !== initialPid) break;
        } catch (e) {}
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }



    expect(newPid, "New PID should be different from initial").not.toBe(initialPid);
    expect(newPid, "New PID should be valid").toBeGreaterThan(0);


    const statusOutput = runCLI(["status"]);
    expect(statusOutput).toContain("Running");
    
    runCLI(["stop"]);
    
    initialDaemon.kill("SIGKILL");
    restartProcess.kill("SIGKILL");
  }, 40000);


});
