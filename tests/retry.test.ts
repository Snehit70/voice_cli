import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../src/utils/retry";

describe("withRetry", () => {
	it("should return result if operation succeeds", async () => {
		const operation = vi.fn(async () => "success");
		const result = await withRetry(operation);
		expect(result).toBe("success");
		expect(operation).toHaveBeenCalledTimes(1);
	});

	it("should retry on failure", async () => {
		let attempts = 0;
		const operation = vi.fn(async () => {
			attempts++;
			if (attempts === 1) throw new Error("fail");
			return "success";
		});

		const result = await withRetry(operation, { maxRetries: 1, backoffs: [1] });
		expect(result).toBe("success");
		expect(attempts).toBe(2);
	});

	it("should fail after max retries", async () => {
		const operation = vi.fn(async () => {
			throw new Error("fail");
		});

		try {
			await withRetry(operation, { maxRetries: 1, backoffs: [1] });
		} catch (e) {
			expect(e).toBeDefined();
		}
		expect(operation).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
	});

	it("should timeout if operation takes too long", async () => {
		const operation = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 500));
			return "success";
		});

		try {
			await withRetry(operation, { timeout: 10, maxRetries: 0 });
			// Should not reach here
			expect(true).toBe(false);
		} catch (e: any) {
			expect(e.message).toContain("timed out");
		}
	});

	it("should not retry if shouldRetry returns false", async () => {
		let attempts = 0;
		const operation = vi.fn(async () => {
			attempts++;
			const error = new Error("fatal");
			(error as any).fatal = true;
			throw error;
		});

		try {
			await withRetry(operation, {
				maxRetries: 2,
				backoffs: [1],
				shouldRetry: (err) => !(err as any).fatal,
			});
		} catch (e) {
			expect(e).toBeDefined();
		}

		expect(attempts).toBe(1);
	});

	it("should pass AbortSignal to operation and abort when timed out", async () => {
		let signalPassed: AbortSignal | undefined;
		let wasAborted = false;

		const operation = async (signal?: AbortSignal) => {
			signalPassed = signal;
			if (signal) {
				signal.addEventListener("abort", () => {
					wasAborted = true;
				});
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
			return "success";
		};

		try {
			await withRetry(operation, { timeout: 10, maxRetries: 0 });
		} catch (e: any) {
			expect(e.message).toContain("timed out");
		}

		expect(signalPassed).toBeDefined();
		expect(wasAborted).toBe(true);
	});
});
