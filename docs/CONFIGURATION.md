# Configuration Guide

This document provides a detailed overview of the configuration options available for `voice-cli`.

## Configuration File

The default configuration file is located at:
`~/.config/voice-cli/config.json`

### Security Requirement
Since the configuration file contains sensitive API keys, it **must** have restricted file permissions.
```bash
chmod 600 ~/.config/voice-cli/config.json
```

## Environment Variables

If an API key is missing from `config.json`, the application will fall back to the following environment variables:

- `GROQ_API_KEY`: Fallback for `apiKeys.groq`
- `DEEPGRAM_API_KEY`: Fallback for `apiKeys.deepgram`

## Configuration Format

The configuration is a JSON file structured into several sections.

### Example Configuration

```json
{
  "apiKeys": {
    "groq": "gsk_...",
    "deepgram": "00000000-0000-0000-0000-000000000000"
  },
  "behavior": {
    "hotkey": "Right Control",
    "toggleMode": true,
    "notifications": true,
    "clipboard": {
      "append": true,
      "minDuration": 0.6,
      "maxDuration": 300
    },
    "audioDevice": "default"
  },
  "paths": {
    "logs": "~/.config/voice-cli/logs/",
    "history": "~/.config/voice-cli/history.json"
  },
  "transcription": {
    "language": "en",
    "boostWords": [
      "voice-cli",
      "Groq",
      "Deepgram"
    ]
  }
}
```

---

## Configuration Sections

### 1. API Keys (`apiKeys`)

Authentication credentials for the transcription services.

| Option | Type | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `groq` | String | N/A | API key for Groq (Whisper V3). | Must start with `gsk_`. Min 10 chars. |
| `deepgram` | String | N/A | API key for Deepgram (Nova-3). | Must be a valid UUID format. |

---

### 2. Behavior (`behavior`)

Controls the core functionality and user interaction of the daemon.

| Option | Type | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `hotkey` | String | `"Right Control"` | Global hotkey to trigger recording. | Supports `Modifier+Key` format. |
| `toggleMode` | Boolean | `true` | If `true`, press once to start and again to stop. If `false`, recording duration is fixed. | N/A |
| `notifications` | Boolean | `true` | Enable/disable desktop notifications for recording status. | N/A |
| `audioDevice` | String | Optional | Specify a custom ALSA audio device name. | N/A |

#### Clipboard Settings (`behavior.clipboard`)

| Option | Type | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `append` | Boolean | `true` | If `true`, appends the transcript to the current clipboard. If `false`, overwrites it. | N/A |
| `minDuration` | Number | `0.6` | Minimum recording duration in seconds. | Min: `0.6` |
| `maxDuration` | Number | `300` | Maximum recording duration in seconds (5 minutes). | Max: `300` |

#### Hotkey Format
The `hotkey` option supports both single keys and combinations using the `+` separator.
- **Examples**: `"Right Control"`, `"Ctrl+Space"`, `"Alt+Shift+V"`, `"F10"`.
- **Supported Modifiers**: `Ctrl`, `Control`, `Alt`, `Shift`, `Meta`, `Super`, `Win`, `Command`, `Cmd`, `Option`.
- **Supported Keys**: `A-Z`, `0-9`, `F1-F24`, `Space`, `Enter`, `Tab`, `Esc`, `Backspace`, `Delete`, `Home`, `End`, `Page Up`, `Page Down`, Arrow keys, and Numpad keys.

---

### 3. Paths (`paths`)

File system locations for logs and history. Supports `~` for home directory expansion.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `logs` | String | `"~/.config/voice-cli/logs/"` | Directory where structured log files are stored. |
| `history` | String | `"~/.config/voice-cli/history.json"` | Path to the transcription history JSON file. |

---

### 4. Transcription (`transcription`)

Settings related to the speech-to-text engine.

| Option | Type | Default | Description | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
| `language` | String | `"en"` | ISO 639-1 language code for transcription. | N/A |
| `boostWords` | Array | `[]` | List of words to prioritize for better accuracy (e.g., names, jargon). | Max 450 words total. |

#### Boost Words Limit
The `boostWords` array is used to improve the detection of specific terms. To maintain performance and stay within API limits, the total number of words across all entries in the array must not exceed **450 words**.

---

## Validation
`voice-cli` uses **Zod** to validate the configuration file on startup. If the configuration is invalid, the daemon will log a detailed error message and fail to start. You can use `bun run index.ts health` to verify if your configuration and API keys are working correctly.
