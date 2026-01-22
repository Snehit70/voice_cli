import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logError } from "../utils/logger";
import { withRetry } from "../utils/retry";

export interface AudioDevice {
	id: string;
	name: string;
	description: string;
}

export class AudioDeviceService {
	/**
	 * Lists available audio input devices using `arecord -L`.
	 * Filters for useful hardware devices and common virtual devices.
	 */
	public async listDevices(): Promise<AudioDevice[]> {
		const execAsync = promisify(exec);
		return withRetry(
			async () => {
				try {
					const result = await execAsync("arecord -L");
					const stdout =
						typeof result === "string"
							? result
							: (result as { stdout: string }).stdout;
					return this.parseArecordOutput(stdout);
				} catch (error) {
					logError("Failed to list audio devices", error);
					throw error;
				}
			},
			{
				operationName: "List audio devices",
				timeout: 5000,
			},
		);
	}

	/**
	 * Parses the output of `arecord -L` into structured objects.
	 */
	private parseArecordOutput(output: string): AudioDevice[] {
		const lines = output.split("\n");
		const devices: AudioDevice[] = [];

		let currentId: string | null = null;
		let descriptionLines: string[] = [];

		const flushDevice = () => {
			if (currentId && descriptionLines.length > 0) {
				// Filter out 'null' device
				if (currentId !== "null") {
					devices.push({
						id: currentId,
						name: currentId, // Using ID as name for now, or could use first line of description
						description: descriptionLines.join(" - ").trim(),
					});
				}
			}
		};

		for (const line of lines) {
			if (!line) continue;

			if (!line.startsWith("    ")) {
				// New device entry
				flushDevice();
				currentId = line.trim();
				descriptionLines = [];
			} else {
				// Description line
				descriptionLines.push(line.trim());
			}
		}

		// Flush last device
		flushDevice();

		return devices;
	}
}
