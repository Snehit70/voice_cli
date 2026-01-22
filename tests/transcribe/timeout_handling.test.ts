import { describe, it, expect, mock, beforeEach } from "bun:test";
import { GroqClient } from "../../src/transcribe/groq";
import { DeepgramTranscriber } from "../../src/transcribe/deepgram";

// Mock config to avoid loading real config
mock.module("../../src/config/loader", () => ({
  loadConfig: () => ({
    apiKeys: {
      groq: "gsk_test",
      deepgram: "deepgram_test"
    }
  })
}));

// Mock logger to suppress output
mock.module("../../src/utils/logger", () => ({
  logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
  logError: () => {}
}));

// Mock dependencies
mock.module("groq-sdk", () => ({
  default: class MockGroq {
    audio = { transcriptions: { create: mock() } }
  }
}));

mock.module("@deepgram/sdk", () => ({
  createClient: () => ({
    listen: { prerecorded: { transcribeFile: mock() } }
  })
}));

mock.module("node:fs", () => ({
  writeFileSync: mock(),
  unlinkSync: mock(),
  createReadStream: mock()
}));

describe("Timeout Handling", () => {
  describe("GroqClient", () => {
    it("should throw 'Groq: Request timed out' when retry times out", async () => {
      // Mock withRetry to simulate timeout
      mock.module("../../src/utils/retry", () => ({
        withRetry: async (fn: any, opts: any) => {
          throw new Error(`${opts.operationName} timed out after ${opts.timeout}ms`);
        }
      }));
      
      // Re-import GroqClient to use the new mock
      const { GroqClient: ReimportedGroq } = await import("../../src/transcribe/groq");
      const client = new ReimportedGroq();
      
      try {
        await client.transcribe(Buffer.from("audio"));
        expect(true).toBe(false); // Should not succeed
      } catch (e: any) {
        expect(e.message).toBe("Groq: Request timed out");
      }
    });
  });

  describe("DeepgramTranscriber", () => {
    it("should throw 'Deepgram: Request timed out' when fallback times out", async () => {
      // Mock withRetry to simulate timeout for BOTH main and fallback
      mock.module("../../src/utils/retry", () => ({
        withRetry: async (fn: any, opts: any) => {
          throw new Error(`${opts.operationName} timed out after ${opts.timeout}ms`);
        }
      }));

      const { DeepgramTranscriber: ReimportedDeepgram } = await import("../../src/transcribe/deepgram");
      const transcriber = new ReimportedDeepgram();

      try {
        await transcriber.transcribe(Buffer.from("audio"));
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.message).toBe("Deepgram: Request timed out");
      }
    });
  });
});
