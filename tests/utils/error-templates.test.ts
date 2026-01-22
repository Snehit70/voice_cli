import { describe, expect, it } from "vitest";
import {
	ErrorTemplates,
	formatUserError,
} from "../../src/utils/error-templates";

describe("ErrorTemplates", () => {
	it("should have correct message and action for static templates", () => {
		const template = ErrorTemplates.API.GROQ_INVALID_KEY;
		expect(template.message).toBe("Groq API key is invalid or missing.");
		expect(template.action).toContain("check your Groq API key");
	});

	it("should have correct message and action for dynamic templates", () => {
		const template = ErrorTemplates.API.RATE_LIMIT_EXCEEDED("Groq");
		expect(template.message).toBe("Groq rate limit exceeded.");
		expect(template.action).toContain("wait a moment");
	});
});

describe("formatUserError", () => {
	it("should format template into a user-friendly string", () => {
		const template = {
			message: "Test error.",
			action: "Test action.",
		};
		const formatted = formatUserError(template);
		expect(formatted).toBe("Test error.\n\nAction: Test action.");
	});
});
