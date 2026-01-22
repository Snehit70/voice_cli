import clipboardy from "clipboardy";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger, logError } from "../utils/logger";
import { loadConfig } from "../config/loader";

const execAsync = promisify(exec);

export class ClipboardManager {
  private isWayland: boolean;

  constructor() {
    this.isWayland = !!process.env.WAYLAND_DISPLAY;
  }

  public async append(text: string): Promise<void> {
    const config = loadConfig();
    const shouldAppend = config.behavior.clipboard.append;

    try {
      let currentContent = "";
      
      try {
        currentContent = await this.read();
      } catch (e) {
        
      }

      const newContent = shouldAppend && currentContent ? `${currentContent}\n${text}` : text;
      
      await this.write(newContent);
      logger.info("Clipboard updated");
    } catch (error) {
      logError("Clipboard operation failed", error);
      throw error;
    }
  }

  private async read(): Promise<string> {
    if (this.isWayland) {
      try {
        const { stdout } = await execAsync("wl-paste");
        return stdout.trim();
      } catch (e) {
        return clipboardy.read();
      }
    }
    return clipboardy.read();
  }

  private async write(text: string): Promise<void> {
    if (this.isWayland) {
      try {
        await this.writeWayland(text);
        return;
      } catch (e) {
        
      }
    }
    await clipboardy.write(text);
  }

  private writeWayland(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { spawn } = require("node:child_process");
      const child = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
      
      child.on("error", reject);
      child.on("close", (code: number) => {
        if (code === 0) resolve();
        else reject(new Error(`wl-copy exited with code ${code}`));
      });

      child.stdin.write(text);
      child.stdin.end();
    });
  }
}
