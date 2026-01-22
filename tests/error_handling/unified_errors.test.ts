import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { GroqClient } from "../../src/transcribe/groq";
import { DeepgramTranscriber } from "../../src/transcribe/deepgram";
import { AudioRecorder } from "../../src/audio/recorder";
import { loadConfig } from "../../src/config/loader";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";

// --- SHARED MOCKS ---

const mockGroqCreate = mock();
const mockGroqList = mock();
mock.module("groq-sdk", () => ({
  default: class {
    audio = { transcriptions: { create: mockGroqCreate } };
    models = { list: mockGroqList };
  }
}));

const mockTranscribeFile = mock();
const mockGetProjects = mock();
mock.module("@deepgram/sdk", () => ({
  createClient: () => ({
    listen: { prerecorded: { transcribeFile: mockTranscribeFile } },
    manage: { getProjects: mockGetProjects }
  })
}));

const mockStream = new EventEmitter();
const mockStop = mock(() => {});
mock.module("node-record-lpcm16", () => ({
  record: mock(() => ({
    stream: () => mockStream,
    stop: mockStop,
    process: { stderr: new EventEmitter() }
  }))
}));

mock.module("../../src/utils/retry", () => ({
  withRetry: async (fn: any) => await fn()
}));

mock.module("../../src/utils/logger", () => ({
  logger: { info: mock(), error: mock(), warn: mock() },
  logError: mock()
}));

// --- TESTS ---

describe("Unified Error Handling Tests", () => {
  const originalEnv = process.env;
  const TEST_DIR = join(tmpdir(), "voice-cli-unified-test-" + Math.random().toString(36).slice(2));
  const CONFIG_FILE = join(TEST_DIR, "config.json");

  beforeEach(() => {
    process.env = { 
      ...originalEnv, 
      GROQ_API_KEY: "gsk_test_key_1234567890",
      DEEPGRAM_API_KEY: "4b5c1234-5678-90ab-cdef-1234567890ab"
    };
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
    mockGroqCreate.mockClear();
    mockGroqList.mockClear();
    mockTranscribeFile.mockClear();
    mockGetProjects.mockClear();
    mockStop.mockClear();
    mockStream.removeAllListeners();
  });

  afterEach(() => {
    process.env = originalEnv;
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
  });

  describe("ConfigLoader Errors", () => {
    it("should throw error on corrupted config", () => {
      writeFileSync(CONFIG_FILE, "{invalid");
      expect(() => loadConfig(CONFIG_FILE)).toThrow("Configuration file is corrupted");
    });

    it("should validate API key formats", () => {
      writeFileSync(CONFIG_FILE, JSON.stringify({ apiKeys: { groq: "invalid" } }));
      expect(() => loadConfig(CONFIG_FILE)).toThrow("Groq API key must start with 'gsk_'");
    });

    it("should validate boost words limit", () => {
      const configData = {
        apiKeys: { groq: "gsk_test", deepgram: "4b5c1234-5678-90ab-cdef-1234567890ab" },
        transcription: { boostWords: Array(451).fill("word") }
      };
      writeFileSync(CONFIG_FILE, JSON.stringify(configData));
      expect(() => loadConfig(CONFIG_FILE)).toThrow("Boost words limit exceeded");
    });
  });

  describe("GroqClient Errors", () => {
    const audioBuffer = Buffer.from("fake-audio");

    it("should throw 'Invalid API Key' on 401", async () => {
      mockGroqList.mockRejectedValue({ status: 401 });
      const client = new GroqClient();
      await expect(client.checkConnection()).rejects.toThrow("Groq: Invalid API Key");
    });

    it("should throw Rate Limit error on 429", async () => {
      mockGroqCreate.mockRejectedValue({ status: 429 });
      const client = new GroqClient();
      await expect(client.transcribe(audioBuffer)).rejects.toThrow("Groq: Rate limit exceeded");
    });

    it("should throw Timeout error on timeout message", async () => {
      mockGroqCreate.mockRejectedValue(new Error("Request timed out"));
      const client = new GroqClient();
      await expect(client.transcribe(audioBuffer)).rejects.toThrow("Groq: Request timed out");
    });
  });

  describe("DeepgramClient Errors", () => {
    const audioBuffer = Buffer.from("fake-audio");

    it("should throw 'Invalid API Key' on 401", async () => {
      mockGetProjects.mockResolvedValue({ error: { status: 401 } });
      const transcriber = new DeepgramTranscriber();
      await expect(transcriber.checkConnection()).rejects.toThrow("Deepgram: Invalid API Key");
    });

    it("should throw Rate Limit error on 429", async () => {
      mockTranscribeFile.mockResolvedValue({ error: { status: 429 } });
      const transcriber = new DeepgramTranscriber();
      await expect(transcriber.transcribe(audioBuffer)).rejects.toThrow("Deepgram: Rate limit exceeded");
    });

    it("should fallback to nova-2 on nova-3 failure", async () => {
      mockTranscribeFile.mockResolvedValueOnce({ error: { status: 500 } });
      mockTranscribeFile.mockResolvedValueOnce({ 
        result: { results: { channels: [{ alternatives: [{ transcript: "fallback" }] }] } },
        error: null 
      });
      const transcriber = new DeepgramTranscriber();
      const res = await transcriber.transcribe(audioBuffer);
      expect(res).toBe("fallback");
      expect(mockTranscribeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe("AudioRecorder Errors", () => {
    it("should handle busy microphone", async (done) => {
      const recorder = new AudioRecorder();
      await recorder.start();
      // @ts-ignore
      const stderr = recorder.recording!.process!.stderr!;
      recorder.on("error", (err) => {
        try {
          expect(err.message).toContain("Microphone is busy");
          done();
        } catch (e) { done(e); }
      });
      stderr.emit("data", Buffer.from("audio open error: Device or resource busy"));
      mockStream.emit("error", new Error("EBUSY"));
    });
  });
});
