import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptMerger } from "../../src/transcribe/merger";
import { logError } from "../../src/utils/logger";

const mockGroqCreate = vi.fn();
vi.mock("groq-sdk", () => {
	return {
		default: class {
			chat = {
				completions: {
					create: mockGroqCreate,
				},
			};
		},
	};
});

vi.mock("../../src/config/loader", () => ({
	loadConfig: vi.fn().mockReturnValue({
		apiKeys: { groq: "gsk_test" },
	}),
}));

vi.mock("../../src/utils/logger", () => ({
	logError: vi.fn(),
}));

describe("TranscriptMerger Edge Cases", () => {
	let merger: TranscriptMerger;

	beforeEach(() => {
		vi.clearAllMocks();
		merger = new TranscriptMerger();
	});

	it("should handle rate limit error (429) correctly", async () => {
		const error: any = new Error("Rate limit");
		error.status = 429;
		mockGroqCreate.mockRejectedValue(error);

		const result = await merger.merge("groq text", "deepgram text");

		expect(result).toBe("deepgram text");
		expect(logError).toHaveBeenCalledWith(
			expect.stringContaining("Rate Limit exceeded"),
			expect.any(Error),
		);
	});

	it("should handle timeout error correctly", async () => {
		const error = new Error("Request timed out");
		mockGroqCreate.mockRejectedValue(error);

		const result = await merger.merge("groq text", "deepgram text");

		expect(result).toBe("deepgram text");
		expect(logError).toHaveBeenCalledWith(
			expect.stringContaining("Timeout"),
			expect.any(Error),
		);
	});

	it("should handle unexpected errors correctly", async () => {
		const error = new Error("Something went wrong");
		mockGroqCreate.mockRejectedValue(error);

		const result = await merger.merge("groq text", "deepgram text");

		expect(result).toBe("deepgram text");
		expect(logError).toHaveBeenCalledWith(
			expect.stringContaining("LLM merge failed"),
			expect.any(Error),
		);
	});

	it("should return groqText if deepgramText is empty on error", async () => {
		mockGroqCreate.mockRejectedValue(new Error("Fail"));
		const result = await merger.merge("groq text", "");
		expect(result).toBe("groq text");
	});

	it("should handle empty content from LLM", async () => {
		mockGroqCreate.mockResolvedValue({
			choices: [{ message: { content: "" } }],
		});

		const result = await merger.merge("groq text", "deepgram text");

		expect(result).toBe("deepgram text");
	});

	it("should handle missing choices from LLM", async () => {
		mockGroqCreate.mockResolvedValue({
			choices: [],
		});

		const result = await merger.merge("groq text", "deepgram text");

		expect(result).toBe("deepgram text");
	});

	it("should retry 2 times on retryable error", async () => {
		const error: any = new Error("Retryable");
		error.status = 500;
		mockGroqCreate.mockRejectedValue(error);

		await merger.merge("groq", "deepgram");

		expect(mockGroqCreate).toHaveBeenCalledTimes(3);
	});

	it("should not retry on 401 error", async () => {
		const error: any = new Error("Unauthorized");
		error.status = 401;
		mockGroqCreate.mockRejectedValue(error);

		await merger.merge("groq", "deepgram");

		expect(mockGroqCreate).toHaveBeenCalledTimes(1);
	});
});
