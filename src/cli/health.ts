import { Command } from "commander";
import { loadConfig, DEFAULT_CONFIG_FILE } from "../config/loader";
import { GroqClient } from "../transcribe/groq";
import { DeepgramTranscriber } from "../transcribe/deepgram";
import { AudioDeviceService } from "../audio/device-service";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { logger } from "../utils/logger";
import { type DaemonState } from "../daemon/service";

export const healthCommand = new Command("health")
  .description("Check system health and configuration")
  .action(async () => {
    console.log("\n🔍 Voice-CLI Health Check");
    console.log("=========================\n");

    let allOk = true;

    // 1. Environment Check
    console.log("--- Environment ---");
    const isWayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland";
    console.log(`OS:      ${process.platform}`);
    console.log(`Session: ${isWayland ? "Wayland" : "X11"}`);

    try {
      if (isWayland) {
        execSync("which wl-copy", { stdio: "ignore" });
        console.log("✅ wl-clipboard found");
      } else {
        execSync("which xclip || which xsel", { stdio: "ignore" });
        console.log("✅ xclip/xsel found");
      }
    } catch (e) {
      console.log("❌ Clipboard tools missing (wl-clipboard or xclip/xsel)");
      allOk = false;
    }

    try {
      execSync("which notify-send", { stdio: "ignore" });
      console.log("✅ libnotify (notify-send) found");
    } catch (e) {
      console.log("⚠️  libnotify missing (notifications may not work)");
    }

    // 2. Configuration Check
    console.log("\n--- Configuration ---");
    let config: any;
    try {
      config = loadConfig();
      console.log(`✅ Config loaded from ${DEFAULT_CONFIG_FILE}`);
      
      const stats = statSync(DEFAULT_CONFIG_FILE);
      const mode = stats.mode & 0o777;
      if (mode === 0o600) {
        console.log("✅ Config file permissions are 600");
      } else {
        console.log(`⚠️  Config file permissions are ${mode.toString(8)} (recommended: 600)`);
      }
    } catch (e) {
      console.log("❌ Config Error:", (e as Error).message);
      allOk = false;
    }

    // 3. API Connectivity Check
    if (config) {
      console.log("\n--- API Connectivity ---");
      
      // Test Groq
      try {
        const groq = new GroqClient();
        // Accessing private client for health check
        const models = await (groq as any).client.models.list();
        if (models && models.data) {
          console.log("✅ Groq API: Connected");
        }
      } catch (e) {
        console.log("❌ Groq API Error:", (e as Error).message);
        allOk = false;
      }

      // Test Deepgram
      try {
        const deepgram = new DeepgramTranscriber();
        // Accessing private client for health check
        const projects = await (deepgram as any).client.manage.getProjects();
        if (projects && projects.result) {
          console.log("✅ Deepgram API: Connected");
        }
      } catch (e) {
        console.log("❌ Deepgram API Error:", (e as Error).message);
        allOk = false;
      }
    }

    // 4. Audio Check
    console.log("\n--- Audio Devices ---");
    try {
      const deviceService = new AudioDeviceService();
      const devices = await deviceService.listDevices();
      if (devices.length > 0) {
        console.log(`✅ ${devices.length} audio devices found`);
        if (config?.behavior?.audioDevice) {
          const found = devices.find(d => d.id === config.behavior.audioDevice);
          if (found) {
            console.log(`✅ Configured device found: ${found.description}`);
          } else {
            console.log(`❌ Configured device not found: ${config.behavior.audioDevice}`);
            allOk = false;
          }
        } else {
          console.log("ℹ️  Using default system microphone");
        }
      } else {
        console.log("❌ No audio devices found");
        allOk = false;
      }
    } catch (e) {
      console.log("❌ Audio Check Error:", (e as Error).message);
      allOk = false;
    }

    // 5. Daemon Check
    console.log("\n--- Daemon Status ---");
    const configDir = join(homedir(), ".config", "voice-cli");
    const pidFile = join(configDir, "daemon.pid");
    const stateFile = join(configDir, "daemon.state");

    if (existsSync(pidFile)) {
      const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
      try {
        process.kill(pid, 0);
        console.log(`✅ Daemon is running (PID: ${pid})`);
        
        if (existsSync(stateFile)) {
          const state: DaemonState = JSON.parse(readFileSync(stateFile, "utf-8"));
          console.log(`✅ Daemon State: ${state.status.toUpperCase()}`);
          if (state.status === "error") {
             console.log(`⚠️  Last Daemon Error: ${state.lastError}`);
          }
        }
      } catch (e) {
        console.log("⚠️  Daemon PID file exists but process is dead");
      }
    } else {
      console.log("ℹ️  Daemon is not running");
    }

    try {
      const isServiceActive = execSync("systemctl --user is-active voice-cli", { stdio: "pipe" }).toString().trim();
      console.log(`✅ systemd service: ${isServiceActive}`);
    } catch (e) {
      console.log("ℹ️  systemd service not active or not installed");
    }

    console.log("\n-------------------------");
    if (allOk) {
      console.log("✅ System health check passed!");
    } else {
      console.log("❌ System health check failed. Please check the issues above.");
    }
    console.log("-------------------------\n");
  });
