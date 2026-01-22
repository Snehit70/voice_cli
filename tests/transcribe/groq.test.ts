import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(async () => ({ text: "  transcribed text  " })),
	list: vi.fn(async () => ({ data: [{ id: "model1" }] })),
}));

vi.mock("../../src/config/loader", () => ({
	loadConfig: vi.fn(() => ({
		apiKeys: {
			groq: "gsk_test_key",
		},
	})),
}));

vi.mock("groq-sdk", () => {
	return {
		default: class MockGroq {
			audio = {
				transcriptions: {
					create: mocks.create,
				},
			};
			models = {
				list: mocks.list,
			};
		},
	};
});

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		writeFileSync: vi.fn(),
		unlinkSync: vi.fn(),
		createReadStream: vi.fn(() => "mock-stream"),
	};
});

vi.mock("../../src/utils/retry", () => ({
	withRetry: async (fn: any, _opts: any) => {
		return await fn();
	},
}));

import { GroqClient } from "../../src/transcribe/groq";

describe("GroqClient", () => {
	let client: GroqClient;

	beforeEach(() => {
		client = new GroqClient();
		mocks.create.mockClear();
		mocks.list.mockClear();
	});

	it("should transcribe audio successfully", async () => {
		const audioBuffer = Buffer.from("fake-audio");
		const text = await client.transcribe(audioBuffer);

		expect(text).toBe("transcribed text");
	});

	it("should include boost words in prompt", async () => {
		const audioBuffer = Buffer.from("fake-audio");

		const text = await client.transcribe(audioBuffer, "en", ["word1", "word2"]);
		expect(text).toBe("transcribed text");
	});

	it("should check connection successfully", async () => {
		const isConnected = await client.checkConnection();
		expect(isConnected).toBe(true);
	});
});
