import { createClient, type DeepgramClient } from "@deepgram/sdk";
import { loadConfig } from "../config/loader";
import { logger, logError } from "../utils/logger";

export class DeepgramTranscriber {
  private client: DeepgramClient;

  constructor() {
    const config = loadConfig();
    this.client = createClient(config.apiKeys.deepgram);
  }

  public async transcribe(audioBuffer: Buffer, language: string = "en", boostWords: string[] = []): Promise<string> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: "nova-3",
          smart_format: true,
          punctuate: true,
          language: language,
          keywords: boostWords,
        }
      );

      if (error) {
        throw error;
      }

      const text = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      
      if (!text) {
        return "";
      }

      return text.trim();
    } catch (error) {
      logError("Deepgram transcription failed", error);
      
      try {
        const { result, error: retryError } = await this.client.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: "nova-2",
            smart_format: true,
            punctuate: true,
            language: language,
            keywords: boostWords,
          }
        );

        if (retryError) throw retryError;
        return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
      } catch (retryError) {
        throw error;
      }
    }
  }
}
