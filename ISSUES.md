# voice-cli Issues & Improvements

> Comprehensive code review conducted Feb 19, 2026. This document catalogs all identified issues, bugs, and improvement opportunities for future development.
>
> **Update (Feb 19, 2026)**: Test suite aggressively cleaned. Reduced from 34 files (~6,120 lines) to 6 files (~825 lines). Only critical integration tests remain.

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Type Safety Issues](#type-safety-issues)
3. [Performance Bottlenecks](#performance-bottlenecks)
4. [Memory Management](#memory-management)
5. [Error Handling](#error-handling)
6. [Test Issues](#test-issues)
7. [Overlay Timing & Logging](#overlay-timing--logging)
8. [Code Quality](#code-quality)
9. [Configuration](#configuration)
10. [Recommendations Summary](#recommendations-summary)

---

## Critical Issues

### ~~1. TypeScript Compilation Error in Tests~~ ✅ RESOLVED

**Status:** Fixed by removing the broken test file during test cleanup.

The file `tests/transcribe/deepgram.test.ts` was deleted as part of aggressive test cleanup. The real Deepgram integration is tested in `tests/integration/deepgram_api.test.ts`.

### 2. Overlay Component Lint Errors

**File:** `overlay/src/renderer/LiveWaveform.tsx`
**Severity:** MEDIUM

| Line | Error |
|------|-------|
| 232 | `forEach()` callback should not return a value (use `for...of` instead) |
| 296 | `forEach()` callback should not return a value (use `for...of` instead) |
| 541 | `aria-hidden="true"` on focusable element (accessibility issue) |

**Fix for lines 232, 296:**
```typescript
// Current:
streamRef.current.getTracks().forEach((track) => track.stop());

// Fix:
for (const track of streamRef.current.getTracks()) {
  track.stop();
}
```

**Fix for line 541:**
```typescript
// Current:
<canvas aria-hidden="true" ... />

// Fix - add tabIndex="-1" to make it non-focusable:
<canvas aria-hidden="true" tabIndex={-1} ... />
```

---

## Type Safety Issues

### 1. `as any` Type Assertions in Production Code

**Severity:** MEDIUM

| File | Line | Issue |
|------|------|-------|
| `src/cli/logs.ts` | 100 | `(err as any).name === "AbortError"` |
| `src/cli/config.ts` | 320, 348, 406 | `loadConfig() as any` - bypasses type checking |
| `src/transcribe/groq.ts` | 67 | `file: file as any` - Groq SDK type mismatch |
| `src/daemon/service.ts` | 276 | `(err as any).code as ErrorCode` |

**Recommendation:** Create proper type guards or extend types to handle these cases safely.

### 2. Empty Catch Blocks

**Severity:** LOW-MEDIUM

Found 29 instances of `catch (_e) {}` that silently swallow errors:

| File | Lines |
|------|-------|
| `src/utils/logger.ts` | 44, 47 |
| `src/utils/stats.ts` | 65 |
| `src/cli/index.ts` | 56, 57, 319, 376, 382, 388 |
| `src/audio/recorder.ts` | 32 |
| `src/daemon/service.ts` | 194, 200, 361 |
| `src/daemon/supervisor.ts` | 78, 84 |
| `src/output/clipboard.ts` | 28 |

**Recommendation:** At minimum, log errors at debug level. Critical paths should handle errors explicitly.

### 3. Biome Lint Warnings

**Severity:** LOW

- `overlay/vite.config.ts:2` - Missing `node:` protocol for path import
- `scripts/examples/*.ts` - Multiple `any` type annotations in catch blocks

---

## Performance Bottlenecks

### 1. Synchronous File Operations in Hot Paths

**Severity:** HIGH

| File | Line | Operation | Impact |
|------|------|-----------|--------|
| `src/daemon/supervisor.ts` | 74, 77 | `readFileSync`, `writeFileSync` | Blocks event loop during crash handling |
| `src/utils/logger.ts` | 42 | `unlinkSync` | Blocks during log rotation |
| `src/output/clipboard.ts` | 49 | `appendFileSync` | Blocks in fallback path |
| `src/config/loader.ts` | 52 | `readFileSync` | Blocks on every config load |
| `src/utils/stats.ts` | 28, 64 | `readFileSync`, `writeFileSync` | Blocks on stats operations |
| `src/utils/history.ts` | 85, 103, 125, 145 | Multiple sync operations | Blocks history operations |

**Recommendation:** Convert to async operations with `fs/promises`. The daemon service already uses `writeFile` from `fs/promises` for state updates (good pattern to follow).

### 2. Config Loading on Every Operation

**Severity:** MEDIUM

`loadConfig()` is called in constructors of:
- `GroqClient` (line 11)
- `DeepgramTranscriber` (line 11)
- `DeepgramStreamingTranscriber` (line 28)
- `TranscriptMerger` (line 48)
- `AudioRecorder` (line 29)
- `DaemonService` (lines 147, 155, 228, 314, 369, 531)

**Current State:** Config IS cached (line 22-23 in loader.ts), but only for the default config path. The cache is properly implemented.

**Issue:** Multiple `loadConfig()` calls within `DaemonService.processAudio()` and `handleTrigger()` could be consolidated.

### 3. Deepgram Streaming Connection Monitoring

**Severity:** LOW

**File:** `src/transcribe/deepgram-streaming.ts:112-140`

Uses polling with 100ms intervals to monitor connection timeout. This is acceptable but could be replaced with a single `setTimeout` for cleaner code.

### 4. Retry Backoff Strategy

**Severity:** LOW

**File:** `src/utils/retry.ts`

Fixed backoffs `[100, 200]ms` may be too aggressive for API rate limits. Consider:
- Exponential backoff option
- Jitter to prevent thundering herd

---

## Memory Management

### 1. Unbounded Array Growth During Recording

**Severity:** MEDIUM

**File:** `src/audio/recorder.ts:89`

```typescript
this.chunks.push(bufferChunk);
```

Chunks array grows unbounded during recording (up to 5 minutes max). At 16kHz mono 16-bit audio:
- 5 minutes = ~9.6MB of audio data

**Mitigation:** Max duration is enforced (5 min), and chunks are cleared on stop. This is acceptable but could benefit from a warning if approaching memory limits.

### 2. Transcript Chunks Accumulation

**Severity:** LOW

**File:** `src/transcribe/deepgram-streaming.ts:20`

```typescript
private transcriptChunks: string[] = [];
```

Accumulates all transcript chunks during streaming. Cleared on `stop()`. Acceptable for typical use.

### 3. Audio Buffer During Connection

**Severity:** LOW

**File:** `src/transcribe/deepgram-streaming.ts:178-189`

Audio is buffered while Deepgram connection is establishing. Has `MAX_BUFFER_CHUNKS = 100` limit with warning. Good implementation.

---

## Error Handling

### 1. Inconsistent Error Typing

**Severity:** MEDIUM

Error handling uses multiple patterns:
- `AppError` with error codes
- `TranscriptionError` extending `AppError`
- `ClipboardAccessError` extending `AppError`
- Raw `Error` objects
- `any` type assertions for error properties

**Recommendation:** Standardize on `AppError` with proper error codes. Create type guards for error checking.

### 2. Missing Error Recovery in Streaming

**Severity:** MEDIUM

**File:** `src/transcribe/deepgram-streaming.ts`

No automatic reconnection on connection drop during recording. If WebSocket drops mid-recording, streaming fails silently and falls back to batch mode.

**Recommendation:** Add reconnection logic with buffered audio replay.

---

## Test Issues ✅ RESOLVED

### Test Suite Cleanup (Feb 19, 2026)

**Status:** Aggressively cleaned per user directive.

| Metric | Before | After |
|--------|--------|-------|
| Test files | 34 | 6 |
| Lines of code | ~6,120 | ~825 |
| Test count | 150+ | 32 |

**Remaining test files (critical only):**
- `tests/config.test.ts` - Config schema validation
- `tests/retry.test.ts` - Retry utility logic
- `tests/integration/crash_recovery.test.ts` - Daemon crash recovery
- `tests/integration/deepgram_api.test.ts` - Real Deepgram API integration
- `tests/integration/groq_api.test.ts` - Real Groq API integration
- `tests/integration/history_storage.test.ts` - History persistence

**Deleted (28 files):**
- Unit tests with excessive mocking
- Tests duplicating integration test coverage
- Manual test documentation
- Edge case tests with low value

All remaining tests pass: `bun test` → 32 tests, 0 failures.

---

## Overlay Timing & Logging

### Current State

**File:** `overlay/src/main.ts`

Timing constants are defined:
```typescript
const SUCCESS_HIDE_DELAY_MS = 1500;
const ERROR_HIDE_DELAY_MS = 3000;
```

**No timing/latency logging exists** for:
- Time from daemon state change to overlay visibility change
- Time from IPC message sent to received
- Overlay show/hide latency

### Recommended Logging Points

1. **IPC Message Latency** (`src/daemon/ipc.ts`)
   - Add timestamp to IPC messages
   - Log round-trip time on client

2. **Overlay Visibility Timing** (`overlay/src/main.ts`)
   ```typescript
   // Add at line 75 (stateChange handler):
   const stateReceivedAt = Date.now();
   console.log(`[TIMING] State change received: ${state.status} at ${stateReceivedAt}`);
   
   // Add after window.show() calls:
   console.log(`[TIMING] Window shown at ${Date.now()}, latency: ${Date.now() - stateReceivedAt}ms`);
   ```

3. **Daemon State Update Timing** (`src/daemon/service.ts`)
   ```typescript
   // Add in setStatus():
   logger.debug({ 
     status, 
     timestamp: Date.now(),
     timeSinceLastChange: Date.now() - this.lastStateChangeTime 
   }, "Status change timing");
   ```

4. **Waveform Render Performance** (`overlay/src/renderer/LiveWaveform.tsx`)
   - The component already uses `requestAnimationFrame` properly
   - Could add FPS counter for debugging

---

## Code Quality

### 1. Hardcoded Values That Should Be Configurable

| File | Line | Value | Suggestion |
|------|------|-------|------------|
| `src/transcribe/merger.ts` | 7 | `MERGE_MODEL = "llama-3.3-70b-versatile"` | Add to config |
| `src/transcribe/deepgram-streaming.ts` | 24 | `MAX_BUFFER_CHUNKS = 100` | Add to config |
| `src/daemon/service.ts` | 25 | `HALLUCINATION_MAX_CHARS = 20` | Add to config |
| `src/audio/recorder.ts` | 18-19 | `WARNING_4M`, `WARNING_430M` | Already configurable via maxDuration |
| `src/utils/retry.ts` | 16 | `backoffs = [100, 200]` | Add to config |

### 2. Missing JSDoc Comments

Core public APIs lack documentation:
- `DaemonService` public methods
- `AudioRecorder` public methods
- `TranscriptMerger.merge()`

### 3. Duplicate IPC Types

`IPCMessage` interface is defined in both:
- `src/daemon/ipc.ts:16-22`
- `overlay/src/ipc-client.ts:27-33`

**Recommendation:** Create shared types package or move to a common location.

---

## Configuration

### 1. Empty boostWords Array

**File:** User's `config.json`

The `boostWords` array is typically empty. Consider:
- Adding default technical vocabulary
- Providing example words in config template
- Adding CLI command to suggest words based on usage

### 2. Missing Overlay Timing Config

Add configurable timing values:
```json
{
  "overlay": {
    "successHideDelay": 1500,
    "errorHideDelay": 3000,
    "showLatencyLogging": false
  }
}
```

---

## Recommendations Summary

### High Priority

1. ~~**Fix TypeScript error** in `tests/transcribe/deepgram.test.ts:84`~~ ✅ RESOLVED (file deleted)
2. **Convert sync file ops to async** in supervisor, logger, clipboard fallback
3. **Add overlay timing logs** for performance monitoring
4. **Standardize error handling** with proper type guards

### Medium Priority

5. **Add Deepgram streaming reconnection** logic
6. **Consolidate config loading** in DaemonService
7. **Add exponential backoff** option to retry utility
8. **Create shared IPC types** between daemon and overlay

### Low Priority

9. **Add JSDoc comments** to public APIs
10. **Make hardcoded values configurable**
11. **Add default boostWords** for common technical terms
12. **Replace empty catch blocks** with debug logging

---

## Metrics for Future Tracking

Once timing logs are added, track:

| Metric | Target | Current |
|--------|--------|---------|
| Overlay show latency | <50ms | Unknown |
| IPC message latency | <10ms | Unknown |
| State file write time | <5ms | Unknown |
| Config load time (cached) | <1ms | Unknown |
| Transcription processing | <2s | ~1.14s (good) |
| LLM merge time | <1s | 300-600ms (good) |

---

*Last updated: Feb 19, 2026*
*Review conducted by: Code Review*
