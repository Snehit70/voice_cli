import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- SHARED MOCKS ---

const mocks = vi.hoisted(() => {
	const { EventEmitter } = require("node:events");
	const stream = new EventEmitter();
	const stop = vi.fn();
	return {
		groqCreate: vi.fn(),
		groqList: vi.fn(),
		transcribeFile: vi.fn(),
		getProjects: vi.fn(),
		stream: stream,
		stop: stop,
		record: vi.fn(() => ({
			stream: () => stream,
			stop: stop,
			process: { stderr: new EventEmitter() },
		})),
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
		logError: vi.fn(),
	};
});

vi.mock("groq-sdk", () => ({
	default: class {
		audio = { transcriptions: { create: mocks.groqCreate } };
		models = { list: mocks.groqList };
	},
}));

vi.mock("@deepgram/sdk", () => ({
	createClient: () => ({
		listen: { prerecorded: { transcribeFile: mocks.transcribeFile } },
		manage: { getProjects: mocks.getProjects },
	}),
}));

vi.mock("node-record-lpcm16", () => ({
	record: mocks.record,
}));

vi.mock("../../src/utils/retry", () => ({
	withRetry: async (fn: any) => await fn(),
}));

vi.mock("../../src/utils/logger", () => ({
	logger: mocks.logger,
	logError: mocks.logError,
}));

// Mock node:fs to prevent real file operations during tests
vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		writeFileSync: vi.fn(),
		unlinkSync: vi.fn(),
		createReadStream: vi.fn(() => new EventEmitter()),
		// Keep existsSync and others as they are used for TEST_DIR setup
	};
});

import { AudioRecorder } from "../../src/audio/recorder";
import { loadConfig } from "../../src/config/loader";
import { DeepgramTranscriber } from "../../src/transcribe/deepgram";
import { GroqClient } from "../../src/transcribe/groq";

// --- TESTS ---

describe("Unified Error Handling Tests", () => {
	const originalEnv = process.env;
	const TEST_DIR = join(
		tmpdir(),
		`voice-cli-unified-test-${Math.random().toString(36).slice(2)}`,
	);
	const CONFIG_FILE = join(TEST_DIR, "config.json");

	beforeEach(() => {
		process.env = {
			...originalEnv,
			GROQ_API_KEY: "gsk_test_key_1234567890",
			DEEPGRAM_API_KEY: "4b5c1234-5678-90ab-cdef-1234567890ab",
		};
		// Ensure we use real fs for TEST_DIR setup before it's used in tests
		if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
		vi.clearAllMocks();
		mocks.stream.removeAllListeners();
	});

	afterEach(() => {
		process.env = originalEnv;
		try {
			rmSync(TEST_DIR, { recursive: true, force: true });
		} catch (_e) {}
	});

	describe("ConfigLoader Errors", () => {
		it("should throw error on corrupted config", () => {
			// Use real writeFileSync for this test as loadConfig uses real fs
			require("node:fs").writeFileSync(CONFIG_FILE, "{invalid");
			expect(() => loadConfig(CONFIG_FILE)).toThrow(
				"Configuration file is corrupted",
			);
		});

		it("should validate API key formats", () => {
			require("node:fs").writeFileSync(
				CONFIG_FILE,
				JSON.stringify({ apiKeys: { groq: "invalid" } }),
			);
			expect(() => loadConfig(CONFIG_FILE)).toThrow(
				"Groq API key must start with 'gsk_'",
			);
		});

		it("should validate boost words limit", () => {
			const configData = {
				apiKeys: {
					groq: "gsk_test",
					deepgram: "4b5c1234-5678-90ab-cdef-1234567890ab",
				},
				transcription: { boostWords: Array(451).fill("word") },
			};
			require("node:fs").writeFileSync(CONFIG_FILE, JSON.stringify(configData));
			expect(() => loadConfig(CONFIG_FILE)).toThrow(
				"Boost words limit exceeded",
			);
		});
	});

	describe("GroqClient Errors", () => {
		const audioBuffer = Buffer.from("fake-audio");

		it("should throw 'Invalid API Key' on 401", async () => {
			mocks.groqList.mockRejectedValue({ status: 401 });
			const client = new GroqClient();
			await expect(client.checkConnection()).rejects.toThrow(
				"Groq: Invalid API Key",
			);
		});

		it("should throw Rate Limit error on 429", async () => {
			mocks.groqCreate.mockRejectedValue({ status: 429 });
			const client = new GroqClient();
			await expect(client.transcribe(audioBuffer)).rejects.toThrow(
				"Groq: Rate limit exceeded",
			);
		});

		it("should throw Timeout error on timeout message", async () => {
			mocks.groqCreate.mockRejectedValue(new Error("Request timed out"));
			const client = new GroqClient();
			await expect(client.transcribe(audioBuffer)).rejects.toThrow(
				"Groq: Request timed out",
			);
		});
	});

	describe("DeepgramClient Errors", () => {
		const audioBuffer = Buffer.from("fake-audio");

		it("should throw 'Invalid API Key' on 401", async () => {
			mocks.getProjects.mockResolvedValue({ error: { status: 401 } });
			const transcriber = new DeepgramTranscriber();
			await expect(transcriber.checkConnection()).rejects.toThrow(
				"Deepgram: Invalid API Key",
			);
		});

		it("should throw Rate Limit error on 429", async () => {
			mocks.transcribeFile.mockResolvedValue({ error: { status: 429 } });
			const transcriber = new DeepgramTranscriber();
			await expect(transcriber.transcribe(audioBuffer)).rejects.toThrow(
				"Deepgram: Rate limit exceeded",
			);
		});

		it("should fallback to nova-2 on nova-3 failure", async () => {
			mocks.transcribeFile.mockResolvedValueOnce({ error: { status: 500 } });
			mocks.transcribeFile.mockResolvedValueOnce({
				result: {
					results: {
						channels: [{ alternatives: [{ transcript: "fallback" }] }],
					},
				},
				error: null,
			});
			const transcriber = new DeepgramTranscriber();
			const res = await transcriber.transcribe(audioBuffer);
			expect(res).toBe("fallback");
			expect(mocks.transcribeFile).toHaveBeenCalledTimes(2);
		});
	});

	describe("AudioRecorder Errors", () => {
		it("should handle busy microphone", () => {
			return new Promise<void>(async (resolve, reject) => {
				const recorder = new AudioRecorder();
				await recorder.start();
				// @ts-expect-error
				const stderr = recorder.recording?.process?.stderr!;
				recorder.on("error", (err) => {
					try {
						expect(err.message).toContain("Microphone is busy");
						resolve();
					} catch (e) {
						reject(e);
					}
				});
				stderr.emit(
					"data",
					Buffer.from("audio open error: Device or resource busy"),
				);
				mocks.stream.emit("error", new Error("EBUSY"));
			});
		});
	});
});
