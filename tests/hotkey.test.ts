import { describe, expect, test, beforeEach, spyOn, mock } from "bun:test";
import { EventEmitter } from "node:events";

const mockGlobalKeyboardListener = new EventEmitter();
(mockGlobalKeyboardListener as any).kill = mock(() => {});
(mockGlobalKeyboardListener as any).addListener = mock(() => {});

const MockGlobalKeyboardListenerConstructor = mock(() => mockGlobalKeyboardListener);

mock.module("node-global-key-listener", () => ({
  GlobalKeyboardListener: MockGlobalKeyboardListenerConstructor
}));

mock.module("../src/utils/logger", () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  },
  logError: mock(() => {}),
}));

mock.module("../src/output/notification", () => ({
  notify: mock(() => {}),
}));

const validConfig = {
  behavior: { hotkey: "Right Control" }
};

let currentConfig = validConfig;

mock.module("../src/config/loader", () => ({
  loadConfig: () => currentConfig
}));

import { HotkeyListener } from "../src/daemon/hotkey";
import { notify } from "../src/output/notification";
import { logError } from "../src/utils/logger";

describe("HotkeyListener", () => {
  let listener: HotkeyListener;

  beforeEach(() => {
    MockGlobalKeyboardListenerConstructor.mockClear();
    (notify as any).mockClear();
    (logError as any).mockClear();
    currentConfig = validConfig;
    listener = new HotkeyListener();
  });

  test("should start successfully with valid config", () => {
    listener.start();
    expect(MockGlobalKeyboardListenerConstructor).toHaveBeenCalled();
  });

  test("should notify and not start if trigger key is empty", () => {
    currentConfig = { behavior: { hotkey: "" } };
    listener.start();
    expect(notify).toHaveBeenCalledWith("Configuration Error", expect.stringContaining("empty trigger key"), "error");
    expect(MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
  });

  test("should notify and throw if listener instantiation fails", () => {
    MockGlobalKeyboardListenerConstructor.mockImplementationOnce(() => {
      throw new Error("Native error");
    });

    expect(() => listener.start()).toThrow("Native error");
    expect(notify).toHaveBeenCalledWith("Hotkey Error", expect.stringContaining("Failed to bind global hotkey"), "error");
    expect(logError).toHaveBeenCalled();
  });

  test("should not start if already registered", () => {
    listener.start();
    MockGlobalKeyboardListenerConstructor.mockClear();
    listener.start();
    expect(MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
  });
});
