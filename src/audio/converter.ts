import { writeFileSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execa } from "execa";
import { logger, logError } from "../utils/logger";
import { AppError } from "../utils/errors";

/**
 * Converts audio buffer to the optimal format for STT APIs:
 * Format: WAV
 * Sample Rate: 16kHz
 * Channels: 1 (Mono)
 * Bit Depth: 16-bit (pcm_s16le)
 * 
 * This ensures compatibility and optimal latency for both Groq and Deepgram.
 */
export async function convertAudio(inputBuffer: Buffer): Promise<Buffer> {
  const tempId = randomUUID();
  const inputPath = join(tmpdir(), `voice-cli-input-${tempId}.wav`);
  const outputPath = join(tmpdir(), `voice-cli-output-${tempId}.wav`);

  try {
    writeFileSync(inputPath, inputBuffer);

    try {
      await execa("ffmpeg", [
        "-y",
        "-i", inputPath,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        outputPath
      ]);
    } catch (ffmpegError: any) {
      if (ffmpegError.code === "ENOENT") {
        throw new AppError("FFMPEG_FAILURE", "FFmpeg is not installed");
      }
      throw new AppError("CONVERSION_FAILED", `FFmpeg conversion failed: ${ffmpegError.message}`);
    }

    if (!existsSync(outputPath)) {
      throw new AppError("CONVERSION_FAILED", "FFmpeg failed to create output file");
    }

    const outputBuffer = readFileSync(outputPath);
    return outputBuffer;
  } catch (error) {
    if (!(error instanceof AppError)) {
      logError("Audio conversion failed", error);
    }
    throw error;
  } finally {
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(outputPath)) unlinkSync(outputPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
