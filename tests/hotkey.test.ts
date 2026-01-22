import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const addListener = vi.fn();
	const kill = vi.fn();

	const mockGlobalKeyboardListener = {
		addListener,
		kill,
	};

	function MockConstructor() {
		return mockGlobalKeyboardListener;
	}

	return {
		mockGlobalKeyboardListener,
		MockGlobalKeyboardListenerConstructor: vi
			.fn()
			.mockImplementation(MockConstructor),
		currentConfig: { behavior: { hotkey: "F10" } },
	};
});

vi.mock("node-global-key-listener", () => ({
	GlobalKeyboardListener: mocks.MockGlobalKeyboardListenerConstructor,
}));

vi.mock("../src/utils/logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	logError: vi.fn(),
}));

vi.mock("../src/output/notification", () => ({
	notify: vi.fn(),
}));

vi.mock("../src/config/loader", () => ({
	loadConfig: () => mocks.currentConfig,
}));

import { HotkeyListener } from "../src/daemon/hotkey";
import { notify } from "../src/output/notification";
import { logError } from "../src/utils/logger";

describe("HotkeyListener", () => {
	let listener: HotkeyListener;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.currentConfig = { behavior: { hotkey: "F10" } };
		listener = new HotkeyListener();
	});

	test("should start successfully with valid config", () => {
		listener.start();
		expect(mocks.MockGlobalKeyboardListenerConstructor).toHaveBeenCalled();
	});

	test("should notify and not start if trigger key is empty", () => {
		mocks.currentConfig = { behavior: { hotkey: "" } };
		listener.start();
		expect(notify).toHaveBeenCalledWith(
			"Configuration Error",
			expect.stringContaining("empty trigger key"),
			"error",
		);
		expect(mocks.MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
	});

	test("should notify and throw if listener instantiation fails", () => {
		mocks.MockGlobalKeyboardListenerConstructor.mockImplementationOnce(() => {
			throw new Error("Native error");
		});

		expect(() => listener.start()).toThrow("Native error");
		expect(notify).toHaveBeenCalledWith(
			"Hotkey Error",
			expect.stringContaining("Failed to bind global hotkey"),
			"error",
		);
		expect(logError).toHaveBeenCalled();
	});

	test("should not start if already registered", () => {
		listener.start();
		mocks.MockGlobalKeyboardListenerConstructor.mockClear();
		listener.start();
		expect(mocks.MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
	});

	test("should emit trigger event on hotkey press", () => {
		let callback: any;
		mocks.mockGlobalKeyboardListener.addListener.mockImplementation(
			(cb: any) => {
				callback = cb;
			},
		);

		let triggered = false;
		listener.on("trigger", () => {
			triggered = true;
		});

		listener.start();

		// Simulate F10 press
		callback({ name: "F10", state: "DOWN" }, { F10: true });
		expect(triggered).toBe(true);
	});

	test("should handle modifier combinations (e.g. Ctrl+Space)", () => {
		mocks.currentConfig = { behavior: { hotkey: "Ctrl+Space" } };
		let callback: any;
		mocks.mockGlobalKeyboardListener.addListener.mockImplementation(
			(cb: any) => {
				callback = cb;
			},
		);

		let triggered = false;
		listener.on("trigger", () => {
			triggered = true;
		});

		listener.start();

		// Simulate Ctrl+Space
		// First Ctrl DOWN
		callback({ name: "LEFT CTRL", state: "DOWN" }, { "LEFT CTRL": true });
		expect(triggered).toBe(false);

		// Then Space DOWN
		callback(
			{ name: "SPACE", state: "DOWN" },
			{ "LEFT CTRL": true, SPACE: true },
		);
		expect(triggered).toBe(true);
	});

	test("should not start if hotkey is disabled", () => {
		mocks.currentConfig = { behavior: { hotkey: "disabled" } };
		listener.start();
		expect(mocks.MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
	});

	test("should not start if hotkey is DISABLED (case insensitive)", () => {
		mocks.currentConfig = { behavior: { hotkey: "DISABLED" } };
		listener.start();
		expect(mocks.MockGlobalKeyboardListenerConstructor).not.toHaveBeenCalled();
	});

	test("should stop listener successfully", () => {
		listener.start();
		listener.stop();
		expect(mocks.mockGlobalKeyboardListener.kill).toHaveBeenCalled();
	});

	test("should not throw on stop if not started", () => {
		expect(() => listener.stop()).not.toThrow();
	});
});
