import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import readlineSync from "readline-sync";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configCommand } from "../../src/cli/config";

const mocks = vi.hoisted(() => {
	const { join } = require("node:path");
	const { tmpdir } = require("node:os");
	const TEST_DIR = join(
		tmpdir(),
		`voice-cli-cli-test-${Math.random().toString(36).slice(2)}`,
	);
	const TEST_CONFIG_FILE = join(TEST_DIR, "config.json");
	return {
		TEST_DIR,
		TEST_CONFIG_FILE,
		mockGlobalKeyboardListener: {
			addListener: vi.fn(),
			kill: vi.fn(),
		},
	};
});

vi.mock("../../src/config/loader", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../../src/config/loader")>();
	return {
		...original,
		loadConfig: (path?: string) =>
			original.loadConfig(path || mocks.TEST_CONFIG_FILE),
		DEFAULT_CONFIG_FILE: mocks.TEST_CONFIG_FILE,
	};
});

vi.mock("readline-sync", () => ({
	default: {
		question: vi.fn(),
		keyInYN: vi.fn(),
		keyIn: vi.fn(),
	},
}));

vi.mock("node-global-key-listener", () => ({
	GlobalKeyboardListener: vi
		.fn()
		.mockImplementation(() => mocks.mockGlobalKeyboardListener),
}));

describe("CLI: config command", () => {
	let logSpy: any;
	let errorSpy: any;

	beforeEach(() => {
		delete process.env.GROQ_API_KEY;
		delete process.env.DEEPGRAM_API_KEY;

		if (!existsSync(mocks.TEST_DIR))
			mkdirSync(mocks.TEST_DIR, { recursive: true });
		writeFileSync(
			mocks.TEST_CONFIG_FILE,
			JSON.stringify({
				apiKeys: {
					groq: "gsk_test_key_12345",
					deepgram: "4b5c1234-5678-90ab-cdef-1234567890ab",
				},
			}),
		);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(mocks.TEST_DIR, { recursive: true, force: true });
		} catch (_e) {}
	});

	test("config list should work", async () => {
		await configCommand.parseAsync(["list"], { from: "user" });

		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls
			.map((call: any[]) => JSON.stringify(call))
			.join("\n");
		expect(output).toContain("gsk_****2345");
		expect(output).toContain("****90ab");
	});

	test("config get should work for specific key", async () => {
		await configCommand.parseAsync(["get", "behavior.hotkey"], {
			from: "user",
		});

		expect(logSpy).toHaveBeenCalled();
		expect(logSpy.mock.calls[0]?.[0]).toBe("Right Control");
	});

	test("config set should update value", async () => {
		await configCommand.parseAsync(["set", "behavior.toggleMode", "false"], {
			from: "user",
		});

		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls
			.map((call: any[]) => JSON.stringify(call))
			.join("\n");
		expect(output).toContain("Set");
		expect(output).toContain("behavior.toggleMode");
		expect(output).toContain("false");

		const content = JSON.parse(readFileSync(mocks.TEST_CONFIG_FILE, "utf-8"));
		expect(content.behavior.toggleMode).toBe(false);
	});

	test("config set should validate value via Zod", async () => {
		await configCommand.parseAsync(["set", "apiKeys.groq", "invalid"], {
			from: "user",
		});

		expect(errorSpy).toHaveBeenCalled();
		const output = errorSpy.mock.calls
			.map((call: any[]) => JSON.stringify(call))
			.join("\n");
		expect(output).toContain(
			"apiKeys.groq: Groq API key must start with 'gsk_'",
		);
	});

	test("config set should handle numbers", async () => {
		await configCommand.parseAsync(
			["set", "behavior.clipboard.minDuration", "1.5"],
			{ from: "user" },
		);

		const content = JSON.parse(readFileSync(mocks.TEST_CONFIG_FILE, "utf-8"));
		expect(content.behavior.clipboard.minDuration).toBe(1.5);
	});

	test("config init should work", async () => {
		if (existsSync(mocks.TEST_CONFIG_FILE)) rmSync(mocks.TEST_CONFIG_FILE);

		vi.mocked(readlineSync.question).mockReturnValueOnce(
			"gsk_new_groq_key_1234567890",
		);
		vi.mocked(readlineSync.question).mockReturnValueOnce(
			"4b5c1234-5678-90ab-cdef-1234567890ab",
		);

		await configCommand.parseAsync(["init"], { from: "user" });

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Configuration initialized"),
		);
		const content = JSON.parse(readFileSync(mocks.TEST_CONFIG_FILE, "utf-8"));
		expect(content.apiKeys.groq).toBe("gsk_new_groq_key_1234567890");
	});

	test.skip("config bind should work", async () => {
		vi.mocked(readlineSync.keyInYN).mockReturnValue(true);

		// Simulate hotkey press by triggering the callback registered in interactiveBind
		mocks.mockGlobalKeyboardListener.addListener.mockImplementation(
			(cb: any) => {
				// Trigger with F10
				cb({ name: "F10", state: "DOWN" }, {});
			},
		);

		await configCommand.parseAsync(["bind"], { from: "user" });

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Selected hotkey"),
		);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("F10"));

		const content = JSON.parse(readFileSync(mocks.TEST_CONFIG_FILE, "utf-8"));
		expect(content.behavior.hotkey).toBe("F10");
	});
});
