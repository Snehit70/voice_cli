import { EventEmitter } from "node:events";
import { GlobalKeyboardListener, type IGlobalKeyEvent } from "node-global-key-listener";
import { logger, logError } from "../utils/logger";
import { loadConfig } from "../config/loader";

export class HotkeyListener extends EventEmitter {
  private listener: GlobalKeyboardListener | null = null;
  private registered = false;

  constructor() {
    super();
  }

  public start() {
    if (this.registered) return;

    try {
      this.listener = new GlobalKeyboardListener();
      const config = loadConfig();
      const hotkey = config.behavior.hotkey.toUpperCase();
      
      const parts = hotkey.split("+").map(p => p.trim());
      const triggerKey = parts[parts.length - 1];
      const modifiers = parts.slice(0, parts.length - 1);

      this.listener.addListener((e: IGlobalKeyEvent, down: Record<string, boolean>) => {
        if (e.state === "DOWN") {
          const keyName = e.name?.toUpperCase();
          if (keyName === triggerKey) {
            const allModifiersPressed = modifiers.every(mod => {
              if (mod === "CTRL" || mod === "CONTROL") return down["LEFT CTRL"] || down["RIGHT CTRL"] || down["LEFT CONTROL"] || down["RIGHT CONTROL"];
              if (mod === "ALT") return down["LEFT ALT"] || down["RIGHT ALT"];
              if (mod === "SHIFT") return down["LEFT SHIFT"] || down["RIGHT SHIFT"];
              if (mod === "META" || mod === "SUPER" || mod === "WIN") return down["LEFT META"] || down["RIGHT META"] || down["LEFT WIN"] || down["RIGHT WIN"];
              
              return down[mod];
            });

            if (allModifiersPressed) {
              logger.info(`Hotkey triggered: ${hotkey}`);
              this.emit("trigger");
            }
          }
        }
      });

      this.registered = true;
      logger.info("Global hotkey listener started");
    } catch (error) {
      logError("Failed to start hotkey listener. Ensure you have permissions (input group or root).", error);
      throw error; 
    }
  }

  public stop() {
    if (this.listener) {
      this.listener.kill();
      this.listener = null;
      this.registered = false;
      logger.info("Global hotkey listener stopped");
    }
  }
}
