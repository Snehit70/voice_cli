import { describe, it, expect } from "vitest";
import { DeepgramTranscriber } from "../../src/transcribe/deepgram";

describe("Deepgram API Integration", () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const isRealKey = apiKey && (apiKey.length === 32 || apiKey.length === 40 || apiKey.includes("-"));

  it("should connect to Deepgram API", async () => {
    if (!isRealKey) {
      console.warn("Skipping Deepgram Integration test: No valid API Key found in environment");
      return;
    }
    try {
      const transcriber = new DeepgramTranscriber();
      const isConnected = await transcriber.checkConnection();
      expect(isConnected).toBe(true);
    } catch (error: any) {
      if (error.message.includes("Invalid API Key")) {
        console.warn("Skipping Deepgram Integration test: Invalid API Key found in environment");
        return;
      }
      throw error;
    }
  });

  it("should transcribe a minimal audio buffer", async () => {
    if (!isRealKey) return;
    try {
      const transcriber = new DeepgramTranscriber();
      
      const sampleRate = 16000;
      const numSamples = 16000;
      const buffer = Buffer.alloc(44 + numSamples * 2);
      
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36 + numSamples * 2, 4);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20); // PCM
      buffer.writeUInt16LE(1, 22); // Mono
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * 2, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write("data", 36);
      buffer.writeUInt32LE(numSamples * 2, 40);

      const text = await transcriber.transcribe(buffer);
      expect(typeof text).toBe("string");
    } catch (error: any) {
      if (error.message.includes("Invalid API Key")) {
        console.warn("Skipping Deepgram Integration test: Invalid API Key found in environment");
        return;
      }
      throw error;
    }
  });
});
