import { describe, expect, test } from "vitest";
import { hotkeyValidator } from "../src/config/schema";

describe("hotkeyValidator", () => {
  test("should validate basic valid hotkeys", () => {
    expect(hotkeyValidator("Right Control")).toBe(true);
    expect(hotkeyValidator("F8")).toBe(true);
    expect(hotkeyValidator("Space")).toBe(true);
    expect(hotkeyValidator("A")).toBe(true);
    expect(hotkeyValidator("1")).toBe(true);
  });

  test("should validate combinations with +", () => {
    expect(hotkeyValidator("Ctrl+Space")).toBe(true);
    expect(hotkeyValidator("Alt+Shift+K")).toBe(true);
    expect(hotkeyValidator("Meta+Enter")).toBe(true);
    expect(hotkeyValidator("Command+Shift+P")).toBe(true);
    expect(hotkeyValidator("Win+L")).toBe(true);
  });

  test("should be case-insensitive", () => {
    expect(hotkeyValidator("ctrl+space")).toBe(true);
    expect(hotkeyValidator("CTRL+SPACE")).toBe(true);
    expect(hotkeyValidator("cTrL+sPaCe")).toBe(true);
    expect(hotkeyValidator("right control")).toBe(true);
  });

  test("should handle whitespace around +", () => {
    expect(hotkeyValidator("Ctrl + Space")).toBe(true);
    expect(hotkeyValidator(" Alt + Shift + K ")).toBe(true);
  });

  test("should validate function keys", () => {
    for (let i = 1; i <= 24; i++) {
      expect(hotkeyValidator(`F${i}`)).toBe(true);
    }
  });

  test("should validate numpad keys", () => {
    for (let i = 0; i <= 9; i++) {
      expect(hotkeyValidator(`NUMPAD ${i}`)).toBe(true);
    }
    expect(hotkeyValidator("NUMPAD DIVIDE")).toBe(true);
    expect(hotkeyValidator("NUMPAD MULTIPLY")).toBe(true);
    expect(hotkeyValidator("NUMPAD SUBTRACT")).toBe(true);
    expect(hotkeyValidator("NUMPAD ADD")).toBe(true);
    expect(hotkeyValidator("NUMPAD ENTER")).toBe(true);
    expect(hotkeyValidator("NUMPAD DECIMAL")).toBe(true);
    expect(hotkeyValidator("NUMPAD DOT")).toBe(true);
  });

  test("should validate navigation and editing keys", () => {
    const keys = [
      "ENTER", "RETURN", "TAB", "ESC", "ESCAPE", "BACKSPACE", 
      "DELETE", "INSERT", "HOME", "END", "PAGE UP", "PAGE DOWN", 
      "UP", "DOWN", "LEFT", "RIGHT", "UP ARROW", "DOWN ARROW", 
      "LEFT ARROW", "RIGHT ARROW", "PRINTSCREEN", "PRINT SCREEN", 
      "SCROLL LOCK", "PAUSE", "BREAK"
    ];
    for (const key of keys) {
      expect(hotkeyValidator(key)).toBe(true);
    }
  });

  test("should validate symbol keys", () => {
    const keys = [
      "MINUS", "EQUAL", "EQUALS", "BRACKET LEFT", "BRACKET RIGHT", 
      "SEMICOLON", "QUOTE", "BACKQUOTE", "BACKSLASH", "COMMA", "PERIOD", 
      "SLASH", "GRAVE", "TILDE", "BACKTICK", "SQUARE BRACKET OPEN", 
      "SQUARE BRACKET CLOSE", "DOT"
    ];
    for (const key of keys) {
      expect(hotkeyValidator(key)).toBe(true);
    }
  });

  test("should reject empty or whitespace-only strings", () => {
    expect(hotkeyValidator("")).toBe(false);
    expect(hotkeyValidator("   ")).toBe(false);
    // @ts-ignore
    expect(hotkeyValidator(null)).toBe(false);
    // @ts-ignore
    expect(hotkeyValidator(undefined)).toBe(false);
  });

  test("should reject invalid key names", () => {
    expect(hotkeyValidator("InvalidKey")).toBe(false);
    expect(hotkeyValidator("Ctrl+InvalidKey")).toBe(false);
    expect(hotkeyValidator("Super+Power")).toBe(false);
    expect(hotkeyValidator("NotAKey")).toBe(false);
  });

  test("should reject invalid formats", () => {
    expect(hotkeyValidator("Ctrl-Space")).toBe(false);
    expect(hotkeyValidator("Ctrl++Space")).toBe(false);
    expect(hotkeyValidator("Ctrl+")).toBe(false);
    expect(hotkeyValidator("+Space")).toBe(false);
  });

  test("should validate specific modifiers", () => {
    expect(hotkeyValidator("LEFT CTRL")).toBe(true);
    expect(hotkeyValidator("RIGHT CONTROL")).toBe(true);
    expect(hotkeyValidator("LEFT ALT")).toBe(true);
    expect(hotkeyValidator("RIGHT SHIFT")).toBe(true);
  });
});
