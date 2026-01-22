import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { convertAudio } from "../../src/audio/converter";
import { execa } from "execa";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

describe("AudioConverter", () => {
  const tempId = randomUUID();
  const inputPath = join(tmpdir(), `test-input-${tempId}.wav`);
  const testOutPath = join(tmpdir(), `test-output-${tempId}.wav`);

  beforeAll(async () => {
    await execa("ffmpeg", [
      "-f", "lavfi",
      "-i", "anullsrc=r=48000:cl=stereo",
      "-t", "1",
      "-c:a", "pcm_s16le",
      inputPath
    ]);
  }, 30000);

  afterAll(() => {
    if (existsSync(inputPath)) {
      unlinkSync(inputPath);
    }
    if (existsSync(testOutPath)) {
      unlinkSync(testOutPath);
    }
  });

  it("should convert audio to 16kHz mono WAV", async () => {
    const inputBuffer = readFileSync(inputPath);
    
    const outputBuffer = await convertAudio(inputBuffer);

    expect(outputBuffer).toBeInstanceOf(Buffer);
    expect(outputBuffer.length).toBeGreaterThan(0);

    writeFileSync(testOutPath, outputBuffer);

    const { stdout } = await execa("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=sample_rate,channels",
      "-of", "csv=p=0",
      testOutPath
    ]);

    const [sampleRate, channels] = stdout.trim().split(",");
    
    expect(sampleRate).toBe("16000");
    expect(channels).toBe("1");
  });
});
