import * as cp from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	exec: vi.fn(),
}));

import { AudioDeviceService } from "../src/audio/device-service";

describe("AudioDeviceService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should list available audio devices correctly", async () => {
		const mockOutput = `null
    Discard all samples (playback) or generate zero samples (capture)
pipewire
    PipeWire Sound Server
default
    Default ALSA Output (currently PipeWire Media Server)
sysdefault:CARD=PCH
    HDA Intel PCH, ALC3246 Analog
    Default Audio Device
front:CARD=PCH,DEV=0
    HDA Intel PCH, ALC3246 Analog
    Front output / input`;

		(cp.exec as any).mockImplementation((_cmd: string, cb: any) => {
			cb(null, mockOutput, "");
			return {} as any;
		});

		const service = new AudioDeviceService();
		const devices = await service.listDevices();

		expect(devices).toHaveLength(4);
		expect(devices[0]?.id).toBe("pipewire");
		expect(devices[1]?.id).toBe("default");
		expect(devices[2]?.id).toBe("sysdefault:CARD=PCH");
		expect(devices[3]?.id).toBe("front:CARD=PCH,DEV=0");
		expect(devices[2]?.description).toContain("HDA Intel PCH");
	});

	it("should retry and eventually throw on failure", async () => {
		const error = new Error("Command failed");
		(cp.exec as any).mockImplementation((_cmd: string, cb: any) => {
			// simulate async delay to ensure withRetry behavior
			setTimeout(() => cb(error, "", "error"), 10);
			return {} as any;
		});

		const service = new AudioDeviceService();
		try {
			await service.listDevices();
			throw new Error("Should have thrown");
		} catch (e: any) {
			expect(e.message).toBe("Command failed");
		}
		expect(cp.exec).toHaveBeenCalledTimes(3);
	}, 15000);
});
