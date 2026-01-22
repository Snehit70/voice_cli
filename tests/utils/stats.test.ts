import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	incrementTranscriptionCount,
	loadStats,
	saveStats,
} from "../../src/utils/stats";

const STATS_FILE = join(homedir(), ".config", "voice-cli", "stats.json");

describe("Stats Utility", () => {
	beforeEach(() => {
		if (existsSync(STATS_FILE)) {
			unlinkSync(STATS_FILE);
		}
	});

	afterEach(() => {
		if (existsSync(STATS_FILE)) {
			unlinkSync(STATS_FILE);
		}
	});

	it("should return default stats when file does not exist", () => {
		const stats = loadStats();
		expect(stats.today).toBe(0);
		expect(stats.total).toBe(0);
		expect(stats.lastDate).toBe(new Date().toISOString().split("T")[0] || "");
	});

	it("should save and load stats correctly", () => {
		const today = new Date().toISOString().split("T")[0] || "";
		const stats = {
			today: 5,
			total: 10,
			lastDate: today,
		};
		saveStats(stats);
		const loaded = loadStats();
		expect(loaded).toEqual(stats);
	});

	it("should reset today count if date changes", () => {
		const today = new Date().toISOString().split("T")[0] || "";
		const oldStats = {
			today: 5,
			total: 10,
			lastDate: "2000-01-01",
		};
		saveStats(oldStats);
		const loaded = loadStats();
		expect(loaded.today).toBe(0);
		expect(loaded.total).toBe(10);
		expect(loaded.lastDate).toBe(today);
	});

	it("should increment counts correctly", () => {
		const stats = incrementTranscriptionCount();
		expect(stats.today).toBe(1);
		expect(stats.total).toBe(1);

		const stats2 = incrementTranscriptionCount();
		expect(stats2.today).toBe(2);
		expect(stats2.total).toBe(2);
	});
});
