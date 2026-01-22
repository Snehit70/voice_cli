import { exec, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";
import clipboardy from "clipboardy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/loader";
import { ClipboardManager } from "../src/output/clipboard";

vi.mock("clipboardy", () => ({
	default: {
		read: vi.fn(),
		write: vi.fn(),
	},
}));

vi.mock("../src/config/loader", () => ({
	loadConfig: vi.fn(() => ({
		behavior: {
			clipboard: {
				append: true,
			},
		},
	})),
}));

vi.mock("../src/utils/logger", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
	logError: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		appendFileSync: vi.fn(),
		existsSync: vi.fn(() => true),
		mkdirSync: vi.fn(),
	};
});

vi.mock("node:child_process", () => ({
	exec: vi.fn(),
	spawn: vi.fn(),
}));

describe("ClipboardManager", () => {
	let manager: ClipboardManager;

	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.WAYLAND_DISPLAY;
		manager = new ClipboardManager();
	});

	it("should append text to existing content", async () => {
		(clipboardy.read as any).mockReturnValue("old");
		(clipboardy.write as any).mockResolvedValue(undefined);

		await manager.append("new");

		expect(clipboardy.write).toHaveBeenCalledWith("old\nnew");
	});

	it("should write directly if clipboard is empty", async () => {
		(clipboardy.read as any).mockReturnValue("");
		(clipboardy.write as any).mockResolvedValue(undefined);

		await manager.append("new");

		expect(clipboardy.write).toHaveBeenCalledWith("new");
	});

	it("should write directly if append is disabled", async () => {
		vi.mocked(loadConfig).mockReturnValueOnce({
			behavior: { clipboard: { append: false } },
		} as any);

		(clipboardy.read as any).mockReturnValue("old");
		await manager.append("new");
		expect(clipboardy.write).toHaveBeenCalledWith("new");
	});

	it("should fallback to file if clipboard write fails and throw ClipboardAccessError", async () => {
		(clipboardy.read as any).mockReturnValue("old");
		(clipboardy.write as any).mockRejectedValue(new Error("clipboard fail"));

		await expect(manager.append("new")).rejects.toThrow(
			"Failed to write to clipboard",
		);
		expect(appendFileSync).toHaveBeenCalled();
	});

	describe("Wayland Support", () => {
		beforeEach(() => {
			process.env.WAYLAND_DISPLAY = "wayland-0";
			manager = new ClipboardManager();
		});

		const mockSpawnSuccess = () => {
			const mockStdin = { write: vi.fn(), end: vi.fn() };
			const mockChild = new EventEmitter();
			(mockChild as any).stdin = mockStdin;
			vi.mocked(spawn).mockReturnValue(mockChild as any);
			setTimeout(() => mockChild.emit("close", 0), 10);
			return { mockChild, mockStdin };
		};

		it("should use wl-paste to read clipboard on Wayland", async () => {
			vi.mocked(exec).mockImplementation(((_cmd: string, cb: any) => {
				cb(null, { stdout: "wayland content" });
			}) as any);

			mockSpawnSuccess();

			await manager.append("new");

			expect(exec).toHaveBeenCalledWith(
				expect.stringContaining("wl-paste"),
				expect.any(Function),
			);
		});

		it("should use wl-copy to write clipboard on Wayland", async () => {
			const { mockStdin, mockChild } = mockSpawnSuccess();

			const promise = manager.append("new");
			await promise;

			expect(spawn).toHaveBeenCalledWith(
				"wl-copy",
				expect.any(Array),
				expect.any(Object),
			);
			expect(mockStdin.write).toHaveBeenCalled();
		});

		it("should fallback to clipboardy if wl-paste fails", async () => {
			vi.mocked(exec).mockImplementation(((_cmd: string, cb: any) => {
				cb(new Error("wl-paste missing"), null);
			}) as any);

			mockSpawnSuccess();
			(clipboardy.read as any).mockReturnValue("clipboardy content");

			await manager.append("new");
			expect(clipboardy.read).toHaveBeenCalled();
		});
	});
});
