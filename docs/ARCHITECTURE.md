# Project Architecture

`voice-cli` follows a feature-based directory structure to ensure high cohesion and low coupling between different parts of the system.

## Directory Structure

```
src/
├── audio/          # Recording and audio device management
├── cli/            # CLI command implementations
├── config/         # Configuration loading, validation, and storage
├── daemon/         # Background service, hotkey handling, and supervisor
├── output/         # Clipboard and notification integration
├── transcribe/     # External API integrations (Groq & Deepgram)
├── utils/          # Shared utilities and helpers
└── types/          # External type definitions
```

## Feature Modules

### 🎤 Audio Management (`src/audio/`)
Responsible for all audio-related operations, including device discovery and capturing raw PCM data.
- **`recorder.ts`**: Handles the `arecord` process lifecycle and provides a stream-based interface for recording.
- **`device-service.ts`**: Discovers and lists available ALSA input devices.
- **`converter.ts`**: (If present) Handles audio format conversions.

### 💻 CLI Interface (`src/cli/`)
Implements the command-line interface using `commander`.
- **`index.ts`**: The main entry point for CLI commands.
- **`config.ts`**: Commands for managing settings (`config bind`, `config set`).
- **`health.ts`**: Diagnostic tool to verify API keys and audio setup.
- **`history.ts`**: Commands to view and clear transcription history.

### ⚙️ Configuration Engine (`src/config/`)
Manages user settings in `~/.config/voice-cli/config.json`.
- **`schema.ts`**: Zod-based validation schema for configuration.
- **`loader.ts`**: Handles reading from disk and merging with environment variables.
- **`writer.ts`**: Safely writes updates back to the configuration file with correct permissions.

### 🛡️ Daemon & Lifecycle (`src/daemon/`)
The core background process that orchestrates the recording and transcription flow.
- **`service.ts`**: The main daemon loop and state management (idle, recording, processing).
- **`hotkey.ts`**: Global hotkey listener using `node-global-key-listener`.
- **`supervisor.ts`**: Implements auto-restart logic and crash protection.
- **`conflict.ts`**: Prevents multiple instances of the daemon from running simultaneously.

### 📤 Output Systems (`src/output/`)
Handles the final results of transcription.
- **`clipboard.ts`**: Appends transcripts to the system clipboard (Wayland/X11 support).
- **`notification.ts`**: Sends desktop notifications via `notify-send`.

### ☁️ Transcription Services (`src/transcribe/`)
Integration with cloud-based AI providers.
- **`groq.ts`**: Implementation for Groq Whisper Large V3.
- **`deepgram.ts`**: Implementation for Deepgram Nova-3.
- **`merger.ts`**: Orchestrates parallel requests and handles fallback logic if one API fails.

### 🛠️ Utilities (`src/utils/`)
Cross-cutting concerns used throughout the project.
- **`logger.ts`**: Structured JSON logging to files.
- **`error-templates.ts`**: Standardized, user-friendly error messages.
- **`retry.ts`**: Generic retry logic with backoff.
- **`stats.ts`**: Tracks usage statistics for the `status` command.

## Data Flow

1. **Wait**: `daemon/hotkey` waits for the global hotkey (default: Right Control).
2. **Record**: `daemon/service` triggers `audio/recorder` to start capturing audio.
3. **Notify**: `output/notification` alerts the user that recording has started.
4. **Stop**: User presses the hotkey again; recording stops.
5. **Transcribe**: `transcribe/merger` sends audio data to Groq and Deepgram in parallel.
6. **Output**: `output/clipboard` appends the best result to the clipboard, and `output/notification` confirms success.
7. **Cleanup**: Temporary audio files are deleted, and the daemon returns to the idle state.
