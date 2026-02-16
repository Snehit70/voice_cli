import Groq from "groq-sdk";
import { loadConfig } from "../config/loader";
import { logError } from "../utils/logger";
import { withRetry } from "../utils/retry";

export class TranscriptMerger {
	private client: Groq;

	constructor() {
		const config = loadConfig();
		this.client = new Groq({
			apiKey: config.apiKeys.groq,
		});
	}

	public async merge(groqText: string, deepgramText: string): Promise<string> {
		if (!groqText && !deepgramText) return "";
		if (!groqText) return deepgramText;
		if (!deepgramText) return groqText;

		if (groqText === deepgramText) return deepgramText;

		try {
			const completion = await withRetry(
				async (signal) => {
					return await this.client.chat.completions.create(
						{
							messages: [
								{
									role: "system",
									content: `You are an expert technical transcription editor.

CONTEXT: This is audio from a software developer discussing programming, Linux systems, development tools, and AI systems. Expect technical jargon, project names, and command-line references.

Source A (Groq Whisper): Accurate words, technical terms, proper nouns.
Source B (Deepgram Nova): Good formatting, punctuation, casing.

EXAMPLES:
- If Source A says "github" and Source B says "get hub", choose "GitHub"
- If Source A says "convex" and Source B says "con next", choose "Convex"
- If Source A says "hyprland" and Source B says "high per land", choose "Hyprland"
- If Source A says "waybar" and Source B says "Vbar", choose "Waybar"
- If Source A says "systemd" and Source B says "system d", choose "systemd"
- If Source A says "antigravity" and Source B says "anti gravity", choose "antigravity"

RULES:
1. Trust Source A for: proper nouns, project names, technical terms, acronyms.
2. Trust Source B for: punctuation, capitalization, number formatting.
3. Preserve technical accuracy over grammatical perfection.
4. Remove: hallucinations, self-corrections, filler words ("um", "uh", "like").
5. Remove spelling clarifications (e.g., "with an I", "spelled S-M-I-T-H").
6. Remove pronunciation meta-commentary (e.g., "that's pronounced...").
7. Remove thinking-out-loud phrases and rhetorical self-questions.
8. Remove false starts and abandoned sentences.
9. Output ONLY the merged text, no quotes or preamble.`,
								},
								{
									role: "user",
									content: `Source A:
${groqText}

Source B:
${deepgramText}`,
								},
							],
							model: "llama-3.3-70b-versatile",
							temperature: 0.0,
							max_tokens: 4096,
						},
						{
							signal,
							timeout: 30000,
							maxRetries: 0,
						},
					);
				},
				{
					operationName: "LLM Merge",
					maxRetries: 2,
					backoffs: [100, 200],
					timeout: 30000,
					shouldRetry: (error: any) => {
						const status = error?.status;
						return status !== 401;
					},
				},
			);

			const merged = completion.choices[0]?.message?.content?.trim();
			return merged || deepgramText || groqText;
		} catch (error: any) {
			if (error?.status === 429) {
				logError(
					"LLM merge skipped (Rate Limit exceeded after retries)",
					error,
				);
			} else if (error?.message?.includes("timed out")) {
				logError("LLM merge skipped (Timeout)", error);
			} else {
				logError("LLM merge failed", error);
			}
			return deepgramText || groqText;
		}
	}
}
