import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig, resolvePath } from "../src/config/loader";
import type { ConfigFile } from "../src/config/schema";
import { saveConfig } from "../src/config/writer";

vi.mock("node:os", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:os")>();
	return {
		...original,
		homedir: vi.fn().mockReturnValue("/mock/home"),
	};
});

describe("Config Integration", () => {
	let tempDir: string;
	let configPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "voice-cli-test-"));
		configPath = join(tempDir, "config.json");
		vi.stubEnv("GROQ_API_KEY", "");
		vi.stubEnv("DEEPGRAM_API_KEY", "");
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.unstubAllEnvs();
	});

	it("should fail to load when API keys are missing", () => {
		expect(() => loadConfig(configPath)).toThrow(/Config validation failed/);
	});

	it("should load from environment variables when file is missing", () => {
		vi.stubEnv("GROQ_API_KEY", "gsk_test_groq_key_12345");
		vi.stubEnv("DEEPGRAM_API_KEY", "00000000-0000-0000-0000-000000000000");

		const config = loadConfig(configPath);
		expect(config.apiKeys.groq).toBe("gsk_test_groq_key_12345");
		expect(config.apiKeys.deepgram).toBe(
			"00000000-0000-0000-0000-000000000000",
		);
	});

	it("should save and load a valid configuration", () => {
		const validConfig: ConfigFile = {
			apiKeys: {
				groq: "gsk_valid_key_from_file",
				deepgram: "12345678-1234-1234-1234-123456789012",
			},
			behavior: {
				hotkey: "Ctrl+Space",
				toggleMode: false,
				notifications: true,
				clipboard: {
					append: true,
					minDuration: 1.0,
					maxDuration: 60,
				},
			},
		};

		saveConfig(validConfig, configPath);

		expect(existsSync(configPath)).toBe(true);

		const stats = statSync(configPath);
		expect(stats.mode & 0o777).toBe(0o600);

		const loaded = loadConfig(configPath);
		expect(loaded.apiKeys.groq).toBe("gsk_valid_key_from_file");
		expect(loaded.behavior.hotkey).toBe("Ctrl+Space");
		expect(loaded.behavior.toggleMode).toBe(false);
		expect(loaded.behavior.clipboard.minDuration).toBe(1.0);
	});

	it("should prioritize file config over environment variables", () => {
		vi.stubEnv("GROQ_API_KEY", "gsk_env_key");

		const fileConfig: ConfigFile = {
			apiKeys: {
				groq: "gsk_file_key",
				deepgram: "12345678-1234-1234-1234-123456789012",
			},
		};
		saveConfig(fileConfig, configPath);

		const config = loadConfig(configPath);
		expect(config.apiKeys.groq).toBe("gsk_file_key");
	});

	it("should resolve paths with ~ expansion", () => {
		const pathWithTilde = "~/some/path";
		const resolved = resolvePath(pathWithTilde);
		expect(resolved).toBe(join("/mock/home", "some/path"));
	});

	describe("Validation Errors", () => {
		const validKeys = {
			groq: "gsk_valid_key",
			deepgram: "12345678-1234-1234-1234-123456789012",
		};

		it("should fail validation for invalid Groq API key", () => {
			const invalidConfig: ConfigFile = {
				apiKeys: {
					groq: "invalid_key",
					deepgram: validKeys.deepgram,
				},
			};
			expect(() => saveConfig(invalidConfig, configPath)).toThrow(
				/Groq API key must start with 'gsk_'/,
			);
		});

		it("should fail validation for invalid Deepgram API key", () => {
			const invalidConfig: ConfigFile = {
				apiKeys: {
					groq: validKeys.groq,
					deepgram: "not-a-uuid",
				},
			};
			expect(() => saveConfig(invalidConfig, configPath)).toThrow(
				/Deepgram API key must be a (40-character hex string or a )?valid UUID format/,
			);
		});

		it("should fail validation for too many boost words", () => {
			const manyWords = Array(451).fill("word");
			const invalidConfig: ConfigFile = {
				apiKeys: validKeys,
				transcription: {
					boostWords: manyWords,
				},
			};
			expect(() => saveConfig(invalidConfig, configPath)).toThrow(
				/Boost words limit exceeded/,
			);
		});

		it("should fail validation for invalid hotkey", () => {
			const invalidConfig: ConfigFile = {
				apiKeys: validKeys,
				behavior: {
					hotkey: "SuperInvalidKey",
				},
			};
			expect(() => saveConfig(invalidConfig, configPath)).toThrow(
				/Invalid hotkey format/,
			);
		});

		it("should fail validation for out of range durations", () => {
			const invalidConfig = {
				apiKeys: validKeys,
				behavior: {
					clipboard: {
						append: true,
						minDuration: 0.1,
						maxDuration: 60,
					},
				},
			};
			expect(() => saveConfig(invalidConfig as any, configPath)).toThrow(
				/minDuration:.*0\.6/,
			);
		});
	});
});
