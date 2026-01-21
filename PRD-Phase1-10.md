# Voice CLI - Phase 1-10 (Core Functionality)

**Tagline:** "Speak, we will get it right"

## Overview

Voice CLI is a production-ready, system-wide speech-to-text daemon for Linux that runs in the background and transcribes voice to clipboard via a global hotkey. Built for developers and coders who need fast, accurate voice input for their workflows, agents, and tools.

**This PRD covers Phase 1-10: Core functionality only (Foundation through Notifications)**

## Tech Stack

- **Runtime**: Node.js >=20 (LTS)
- **Language**: TypeScript (strict mode, minimal `any` usage)
- **Package Manager**: Bun (primary), npm/npx compatible
- **Audio Capture**: TBD - research production-ready library for Linux
- **Global Hotkey**: `node-global-key-listener` (cross-platform, no root)
- **STT Engines**: Groq (Whisper Large V3) + Deepgram (Nova-3)
- **LLM**: Groq (Llama 3.3 70B) for transcript merging
- **Testing**: Vitest (80%+ coverage target)
- **Linting**: Biome (fast, all-in-one)
- **Logging**: Structured logging (for debugging user issues)

## Architecture

- **Pattern**: Feature-based structure (`/daemon`, `/audio`, `/transcribe`, `/output`, `/cli`, `/config`)
- **Code Style**: Mixed/pragmatic (use what fits best)
- **Configuration**: `~/.config/voice-cli/config.json` + environment variables
- **Daemon Management**: systemd service + built-in commands (start/stop/status/health)
- **Hotkey Behavior**: Toggle mode (press once to start, press again to stop)
- **Default Hotkey**: Right Control key

## Platform Support

- **Primary**: Linux with Wayland (Hyprland priority)
- **Secondary**: X11 support if possible
- **Distros**: All major Linux distributions (Ubuntu, Fedora, Arch, etc.)

## Data Models

### Configuration Schema
```typescript
interface Config {
  apiKeys: {
    groq: string;
    deepgram: string;
  };
  hotkey: string;           // e.g., "RightControl", "F8"
  boostWords: string[];     // Max 450 words
  audioDevice?: string;     // Optional: specific mic device
  language: string;         // Default: "en" (English only for v1.0)
}
```

### Daemon State
```typescript
interface DaemonState {
  status: "idle" | "recording" | "processing" | "error";
  pid: number;
  uptime: number;           // Seconds since start
  lastTranscription?: Date;
  errorCount: number;
}
```

## Tasks - Phase 1-10 Only

### Phase 1: Project Foundation (Priority: Critical)
- [ ] Initialize Bun project with TypeScript (strict mode)
- [ ] Set up project structure (feature-based: `/daemon`, `/audio`, `/transcribe`, `/output`, `/cli`, `/config`)
- [ ] Configure Biome for linting and formatting
- [ ] Configure Vitest for testing
- [ ] Create `package.json` with scripts (start, dev, test, lint, build)
- [ ] Set up structured logging library (e.g., `pino` or `winston`)
- [ ] Create `.gitignore` (node_modules, logs, config files with secrets)
- [ ] Create `tsconfig.json` with strict mode enabled

### Phase 2: Configuration Management (Priority: Critical)
- [ ] Create config schema with TypeScript interfaces
- [ ] Implement config file reader (`~/.config/voice-cli/config.json`)
- [ ] Implement config file writer with validation
- [ ] Add API key format validation (Groq, Deepgram)
- [ ] Add hotkey validation (valid key combinations)
- [ ] Add boost words validation (max 450 words)
- [ ] Create default config template
- [ ] Add environment variable support (fallback to env vars)
- [ ] Create config directory on first run (`~/.config/voice-cli/`)
- [ ] Set proper file permissions (chmod 600 for config file)

### Phase 3: Audio Capture (Priority: Critical)
- [ ] Research and select production-ready audio library for Linux
- [ ] Implement microphone detection and listing
- [ ] Implement audio recording start/stop
- [ ] Add minimum recording length validation (0.6 seconds)
- [ ] Add maximum recording length limit (5 minutes)
- [ ] Implement recording duration tracking
- [ ] Add silent audio detection (warn if no audio)
- [ ] Implement audio format conversion (to format required by STT APIs)
- [ ] Add error handling for microphone permission denied
- [ ] Add error handling for no microphone detected

### Phase 4: Global Hotkey System (Priority: Critical)
- [ ] Install and configure `node-global-key-listener`
- [ ] Implement hotkey registration (default: Right Control)
- [ ] Implement toggle mode (press to start, press to stop)
- [ ] Add hotkey state management (idle/recording)
- [ ] Add hotkey configuration from config file
- [ ] Test hotkey on Wayland (Hyprland priority)
- [ ] Test hotkey on X11 (if possible)
- [ ] Add error handling for hotkey registration failure
- [ ] Add hotkey conflict detection (if key already in use)

### Phase 5: STT Integration - Groq (Priority: Critical)
- [ ] Install Groq SDK
- [ ] Implement Groq API client with authentication
- [ ] Implement audio upload to Groq (Whisper Large V3)
- [ ] Add boost words support (custom vocabulary)
- [ ] Add language detection (English-only validation)
- [ ] Implement retry logic (max 2 attempts, short backoff)
- [ ] Add timeout handling (fail fast)
- [ ] Add error handling for invalid API key
- [ ] Add error handling for API timeout
- [ ] Add error handling for rate limits

### Phase 6: STT Integration - Deepgram (Priority: Critical)
- [ ] Install Deepgram SDK
- [ ] Implement Deepgram API client with authentication
- [ ] Implement audio upload to Deepgram (Nova-3)
- [ ] Add boost words support (custom vocabulary)
- [ ] Implement retry logic (max 2 attempts, short backoff)
- [ ] Add timeout handling (fail fast)
- [ ] Add error handling for invalid API key
- [ ] Add error handling for API timeout
- [ ] Add error handling for rate limits

### Phase 7: Dual STT Orchestration (Priority: Critical)
- [ ] Implement parallel execution (Promise.all for Groq + Deepgram)
- [ ] Add fallback logic (if one fails, use the other)
- [ ] Add error handling for both APIs failing
- [ ] Implement result aggregation (collect both transcripts)
- [ ] Add processing time tracking
- [ ] Log both raw transcripts for debugging

### Phase 8: LLM Merger (Priority: Critical)
- [ ] Implement Groq LLM client (Llama 3.3 70B)
- [ ] Create merge prompt (trust Groq for words, Deepgram for formatting)
- [ ] Implement transcript merging logic
- [ ] Add post-processing (remove hallucinations, fix grammar)
- [ ] Add fallback (if LLM fails, use Groq transcript only)
- [ ] Add error handling for LLM API failures
- [ ] Test merge quality with sample transcripts

### Phase 9: Clipboard Integration (Priority: Critical)
- [ ] Research clipboard library for Linux (Wayland + X11 support)
- [ ] Implement clipboard write with APPEND mode (NEVER overwrite)
- [ ] Test clipboard on Wayland (Hyprland)
- [ ] Test clipboard on X11
- [ ] Add error handling for clipboard access denied
- [ ] Add fallback (if clipboard fails, save to file)
- [ ] Verify previous clipboard content is preserved

### Phase 10: Desktop Notifications (Priority: High)
- [ ] Install notification library (e.g., `node-notifier`)
- [ ] Implement notification for recording started
- [ ] Implement notification for recording stopped
- [ ] Implement notification for transcription ready
- [ ] Implement notification for errors (API failures, mic issues)
- [ ] Implement notification for warnings (4min, 4.5min limits)
- [ ] Test notifications on GNOME
- [ ] Test notifications on KDE
- [ ] Test notifications on Hyprland

## Validation Rules

### API Keys
- Groq API key: Must start with `gsk_` (format validation)
- Deepgram API key: Must be valid UUID format (format validation)
- Both keys required before daemon can start

### Boost Words
- Maximum: 450 words (~500 tokens at 4 chars/token)
- Validation: Count words, reject if > 450
- Format: Array of strings in config file

### Audio Recording
- Minimum length: 0.6 seconds (reject shorter recordings)
- Maximum length: 5 minutes (auto-stop at 5:00)
- Warnings: Desktop notifications at 4:00 and 4:30
- Silent audio: Warn user if no audio detected

### Hotkey
- Must be a valid key combination
- Default: Right Control
- Validation: Check if key exists in `node-global-key-listener` key map
- Conflict detection: Warn if key already in use by system

### Configuration File
- Must be valid JSON
- Required fields: apiKeys.groq, apiKeys.deepgram
- Optional fields: hotkey, boostWords, audioDevice, language
- Corrupted file: Reset to defaults with user confirmation

## Error Handling Strategy

### Logging
- All errors logged to file (`~/.config/voice-cli/logs/error.log`)
- Structured format (JSON) for easy parsing
- Include timestamp, error type, stack trace, context

### User Notifications
- Critical errors: Desktop notification + log
- Non-critical errors: Log only
- User-friendly messages: Actionable, explain what went wrong and how to fix

### API Errors
- Groq timeout: Retry once, then fallback to Deepgram only
- Deepgram timeout: Retry once, then fallback to Groq only
- Both fail: Show error notification, log details, suggest checking API keys
- Invalid API key: Show setup instructions, link to API key pages

### Audio Errors
- No microphone: Show error notification, list troubleshooting steps
- Permission denied: Show error notification, explain how to grant permission
- Recording fails mid-recording: Abort, show error, suggest trying again

### System Errors
- Clipboard access denied: Fallback to file output (`~/.config/voice-cli/last-transcription.txt`)
- Config file corrupted: Offer to reset to defaults

### Retry Logic
- API calls: Max 2 attempts with short backoff (100ms, 200ms)
- Philosophy: Fail fast, let user retry manually
- No exponential backoff (prioritize speed over exhaustive retries)

## Success Criteria for Phase 1-10

- [ ] Project structure created with TypeScript strict mode
- [ ] Configuration management works (read/write/validate)
- [ ] Audio recording works (0.6s min, 5min max with warnings)
- [ ] Global hotkey works (toggle mode, Right Control default)
- [ ] Groq STT integration works (Whisper Large V3)
- [ ] Deepgram STT integration works (Nova-3)
- [ ] Dual STT orchestration works (parallel execution, fallback)
- [ ] LLM merger produces high-quality transcriptions
- [ ] Clipboard integration works (APPEND mode, never overwrite)
- [ ] Desktop notifications work (recording start/stop, transcription ready, errors)
- [ ] Error handling is robust (user-friendly messages, proper logging)
- [ ] All validation rules enforced (API keys, boost words, audio, hotkey)
- [ ] Works on Hyprland (Wayland) - primary target
- [ ] No clipboard overwrites (critical requirement verified)

## Notes for Ralphy

- **Critical Requirement**: Clipboard APPEND mode (never overwrite) - test thoroughly
- **Wayland Priority**: Focus on Hyprland first, then other Wayland compositors
- **Error Messages**: Must be user-friendly and actionable
- **Code Quality**: TypeScript strict mode, minimal `any`, self-documenting code
- **Audio Library**: Research needed - choose production-ready library for Linux
- **Hotkey Library**: Use `node-global-key-listener` (confirmed)
- **Logging**: Structured format (JSON) for debugging user issues
- **Phase 1-10 Only**: This PRD covers core functionality only. Phase 11-26 (daemon management, systemd, testing, docs) will be done separately.
