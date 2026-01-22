import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptMerger } from "../../src/transcribe/merger";
import testCases from "./samples/merger_test_cases.json";

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

describe("TranscriptMerger Quality Evaluation", () => {
	let merger: TranscriptMerger;

	beforeEach(() => {
		vi.clearAllMocks();
		merger = new TranscriptMerger();
	});

	testCases.forEach((tc) => {
		it(`should merge: ${tc.name}`, async () => {
			mockGroqCreate.mockResolvedValue({
				choices: [{ message: { content: tc.ideal } }],
			});

			const result = await merger.merge(tc.groq, tc.deepgram);

			expect(mockGroqCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.stringContaining("Transcript 1 (Groq Whisper)"),
						}),
						expect.objectContaining({
							role: "user",
							content: expect.stringContaining(tc.groq),
						}),
						expect.objectContaining({
							role: "user",
							content: expect.stringContaining(tc.deepgram),
						}),
					]),
					model: "llama-3.3-70b-versatile",
					temperature: 0.1,
				}),
				expect.anything(),
			);

			expect(result).toBe(tc.ideal);
		});
	});

	it("should handle empty inputs gracefully", async () => {
		expect(await merger.merge("", "")).toBe("");
		expect(await merger.merge("text", "")).toBe("text");
		expect(await merger.merge("", "text")).toBe("text");
	});

	it("should handle identical transcripts without LLM call", async () => {
		const text = "Exactly the same text.";
		const result = await merger.merge(text, text);
		expect(result).toBe(text);
		expect(mockGroqCreate).not.toHaveBeenCalled();
	});

	it("should fallback to Deepgram on LLM error", async () => {
		mockGroqCreate.mockRejectedValue(new Error("Overloaded"));
		const result = await merger.merge("groq", "Deepgram.");
		expect(result).toBe("Deepgram.");
	});
});
