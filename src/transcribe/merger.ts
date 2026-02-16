import Groq from "groq-sdk";
import { loadConfig } from "../config/loader";
import { logError, logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

const MODEL_A = "llama-3.3-70b-versatile";
const MODEL_B = "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are an expert technical transcription editor.

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
9. Output ONLY the merged text, no quotes or preamble.`;

interface ModelResult {
	model: string;
	result: string;
	timeMs: number;
	error?: string;
}

export interface MergeResult {
	text: string;
	accuracy: {
		sourcesMatch: boolean;
		editDistance: number;
		confidence: number;
	};
}

function levenshteinDistance(a: string, b: string): number {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		const row: number[] = new Array(a.length + 1).fill(0);
		row[0] = i;
		matrix.push(row);
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0]![j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i]![j] = matrix[i - 1]![j - 1]!;
			} else {
				matrix[i]![j] = Math.min(
					matrix[i - 1]![j - 1]! + 1,
					matrix[i]![j - 1]! + 1,
					matrix[i - 1]![j]! + 1,
				);
			}
		}
	}

	return matrix[b.length]![a.length]!;
}

export class TranscriptMerger {
	private client: Groq;

	constructor() {
		const config = loadConfig();
		this.client = new Groq({
			apiKey: config.apiKeys.groq,
		});
	}

	private async callModel(
		model: string,
		groqText: string,
		deepgramText: string,
	): Promise<ModelResult> {
		const startTime = Date.now();
		try {
			const completion = await withRetry(
				async (signal) => {
					return await this.client.chat.completions.create(
						{
							messages: [
								{ role: "system", content: SYSTEM_PROMPT },
								{
									role: "user",
									content: `Source A:
${groqText}

Source B:
${deepgramText}`,
								},
							],
							model,
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
					operationName: `LLM Merge (${model})`,
					maxRetries: 2,
					backoffs: [100, 200],
					timeout: 30000,
					shouldRetry: (error: any) => {
						const status = error?.status;
						return status !== 401;
					},
				},
			);

			const result = completion.choices[0]?.message?.content?.trim() || "";
			return { model, result, timeMs: Date.now() - startTime };
		} catch (error: any) {
			return {
				model,
				result: "",
				timeMs: Date.now() - startTime,
				error: error?.message || "Unknown error",
			};
		}
	}

	public async merge(
		groqText: string,
		deepgramText: string,
	): Promise<MergeResult> {
		const sourcesMatch = groqText === deepgramText;

		if (!groqText && !deepgramText) {
			return {
				text: "",
				accuracy: { sourcesMatch, editDistance: 0, confidence: 1 },
			};
		}
		if (!groqText) {
			return {
				text: deepgramText,
				accuracy: { sourcesMatch, editDistance: 0, confidence: 0.5 },
			};
		}
		if (!deepgramText) {
			return {
				text: groqText,
				accuracy: { sourcesMatch, editDistance: 0, confidence: 0.5 },
			};
		}

		if (sourcesMatch) {
			return {
				text: deepgramText,
				accuracy: { sourcesMatch: true, editDistance: 0, confidence: 1 },
			};
		}

		const [resultA, resultB] = await Promise.all([
			this.callModel(MODEL_A, groqText, deepgramText),
			this.callModel(MODEL_B, groqText, deepgramText),
		]);

		logger.info(
			{
				abTest: true,
				modelA: {
					model: resultA.model,
					timeMs: resultA.timeMs,
					resultLength: resultA.result.length,
					error: resultA.error,
				},
				modelB: {
					model: resultB.model,
					timeMs: resultB.timeMs,
					resultLength: resultB.result.length,
					error: resultB.error,
				},
				groqTextLength: groqText.length,
				deepgramTextLength: deepgramText.length,
			},
			"A/B merge complete",
		);

		const selectedModel = Math.random() < 0.5 ? resultA : resultB;

		logger.info(
			{
				abTest: true,
				selectedModel: selectedModel.model,
				selectedTimeMs: selectedModel.timeMs,
			},
			"A/B model selected",
		);

		let finalText: string;
		if (selectedModel.result) {
			finalText = selectedModel.result;
		} else if (resultA.result) {
			finalText = resultA.result;
		} else if (resultB.result) {
			finalText = resultB.result;
		} else {
			logError("Both A/B models failed, using fallback");
			finalText = deepgramText || groqText;
		}

		const avgSourceLength = (groqText.length + deepgramText.length) / 2;
		const distToGroq = levenshteinDistance(finalText, groqText);
		const distToDeepgram = levenshteinDistance(finalText, deepgramText);
		const editDistance = Math.round((distToGroq + distToDeepgram) / 2);

		const maxPossibleDistance = avgSourceLength;
		const confidence = Math.max(
			0,
			Math.min(1, 1 - editDistance / maxPossibleDistance),
		);

		return {
			text: finalText,
			accuracy: {
				sourcesMatch: false,
				editDistance,
				confidence: Math.round(confidence * 100) / 100,
			},
		};
	}
}
