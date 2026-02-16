# voice-cli Optimization Plan

**Created:** Feb 16, 2026
**Status:** In Progress (Pre-Alpha)
**Version:** 0.2.0

---

## 1. Completed Optimizations ✅

### Phase 1: Boost Words Population
- **Status:** ✅ Done
- **Location:** `~/.config/voice-cli/config.json`
- **Words Added:** Hyprland, Waybar, Convex, OpenTUI, antigravity, IITMBS, systemd, Dbus

### Phase 2: Improved Merger Prompt
- **Status:** ✅ Done
- **Location:** `src/transcribe/merger.ts`
- **Changes:** Technical context, few-shot examples, accuracy > grammar

### Phase 3: A/B Model Testing
- **Status:** ✅ Done
- **Location:** `src/transcribe/merger.ts`
- **Changes:** Both LLM models run parallel, 50/50 random pick

### Phase 4: Accuracy Tracking
- **Status:** ✅ Done
- **Changes:** Levenshtein distance, sourcesMatch, editDistance, confidence

---

## 2. Pre-Alpha Release: v0.2.0

### What's New
- Boost words for technical terms
- Improved merger with few-shot examples
- A/B testing between LLM models
- Accuracy metrics in logs

---

## 3. Future: Waybar Integration

### Problem
- System notifications (dunst/mako) have 1-4 second delay

### Solution
```
┌────────────────────────────────────────┐
│  🎤 Recording │ ⚙️ Processing │ ✅ Done │
└────────────────────────────────────────┘
```

### Architecture

```
voice-cli Daemon ──► /tmp/voice-cli-status.json ──► Waybar Script
```

### Status States

| State | Icon | Description |
|-------|------|-------------|
| idle | 󰝤 | Waiting |
| recording | 󰍬 | Recording |
| processing | 󰨹 | Transcribing |
| merging | 󰛦 | LLM merge |
| success | 󰗾 | Done |
| error | 󰚌 | Error |

### Effort: ~1.5 hours

---

## 4. Skipped Items

| Phase | Reason |
|-------|--------|
| Pronunciation | TTS feature, not STT |
| Context Field | Not supported by APIs |
| Streaming Stability | Low impact, works fine |

---

## 5. Notes

- A/B: llama-3.3-70b vs gpt-oss-120b run parallel
- Check logs: `grep "A/B" ~/.config/voice-cli/logs/voice-cli-*.log`
