import { describe, it, expect, vi, beforeEach } from "vitest";
import notifier from "node-notifier";
import { notify } from "../src/output/notification";
import { loadConfig } from "../src/config/loader";
import { logger } from "../src/utils/logger";

vi.mock("node-notifier", () => ({
  default: {
    notify: vi.fn()
  }
}));

vi.mock("../src/config/loader", () => ({
  loadConfig: vi.fn(() => ({
    behavior: {
      notifications: true
    }
  }))
}));

vi.mock("../src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call notifier.notify when notifications are enabled", () => {
    notify("Test Title", "Test Message", "info");

    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({
      title: "Voice CLI: Test Title",
      message: "Test Message",
      icon: "dialog-information"
    }));
    expect(logger.info).toHaveBeenCalled();
  });

  it("should NOT call notifier.notify when notifications are disabled", () => {
    vi.mocked(loadConfig).mockReturnValueOnce({
      behavior: {
        notifications: false
      }
    } as any);

    notify("Test Title", "Test Message", "info");

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("should handle error when notifier fails", () => {
    vi.mocked(notifier.notify).mockImplementationOnce(() => {
      throw new Error("Notifier error");
    });

    notify("Test Title", "Test Message", "info");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Failed to send notification"
    );
  });

  it("should use correct icons for different types", () => {
    notify("Success", "msg", "success");
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ icon: "emblem-default" }));

    notify("Warning", "msg", "warning");
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ icon: "dialog-warning" }));

    notify("Error", "msg", "error");
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ icon: "dialog-error", sound: true }));
  });
});
