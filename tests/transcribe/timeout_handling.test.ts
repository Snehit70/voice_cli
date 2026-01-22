import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	withRetry: vi.fn(async (fn: any, _opts: any) => await fn()),
	groqCreate: vi.fn(),
	deepgramTranscribe: vi.fn(),
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
	createReadStream: vi.fn(),
}));

vi.mock("../../src/config/loader", () => ({
	loadConfig: () => ({
		apiKeys: {
			groq: "gsk_test",
			deepgram: "4b5c1234-5678-90ab-cdef-1234567890ab",
		},
	}),
}));

vi.mock("../../src/utils/logger", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
	logError: vi.fn(),
}));

vi.mock("groq-sdk", () => ({
	default: class MockGroq {
		audio = { transcriptions: { create: mocks.groqCreate } };
	},
}));

vi.mock("@deepgram/sdk", () => ({
	createClient: () => ({
		listen: { prerecorded: { transcribeFile: mocks.deepgramTranscribe } },
	}),
}));

vi.mock("node:fs", () => ({
	writeFileSync: mocks.writeFileSync,
	unlinkSync: mocks.unlinkSync,
	createReadStream: mocks.createReadStream,
}));

vi.mock("../../src/utils/retry", () => ({
	withRetry: mocks.withRetry,
}));

import { DeepgramTranscriber } from "../../src/transcribe/deepgram";
import { GroqClient } from "../../src/transcribe/groq";

describe("Timeout Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.withRetry.mockImplementation(
			async (fn: any, _opts: any) => await fn(),
		);
	});

	describe("GroqClient", () => {
		it("should throw 'Groq: Request timed out' when retry times out", async () => {
			mocks.withRetry.mockImplementation(async (_fn: any, opts: any) => {
				throw new Error(
					`${opts.operationName} timed out after ${opts.timeout}ms`,
				);
			});

			const client = new GroqClient();

			try {
				await client.transcribe(Buffer.from("audio"));
				expect(true).toBe(false);
			} catch (e: any) {
				expect(e.message).toBe("Groq: Request timed out");
			}
		});
	});

	describe("DeepgramTranscriber", () => {
		it("should throw 'Deepgram: Request timed out' when fallback times out", async () => {
			mocks.withRetry.mockImplementation(async (_fn: any, opts: any) => {
				throw new Error(
					`${opts.operationName} timed out after ${opts.timeout}ms`,
				);
			});

			const transcriber = new DeepgramTranscriber();

			try {
				await transcriber.transcribe(Buffer.from("audio"));
				expect(true).toBe(false);
			} catch (e: any) {
				expect(e.message).toBe("Deepgram: Request timed out");
			}
		});
	});
});
