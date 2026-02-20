# LLM Merge Optimization Analysis

**Date:** Feb 2026  
**Model:** llama-3.3-70b-versatile (Groq)

## Current State

**merger.ts Implementation:**
- Model: `llama-3.3-70b-versatile` (configurable)
- Temperature: `0.1` (good for deterministic output)
- Max tokens: `4096`
- System prompt: ~31 lines focused on technical transcription editing

## Model Limits (llama-3.3-70b-versatile)

| Parameter | Value |
|-----------|-------|
| **Context Window** | 131,072 tokens (~128K) |
| **Max Output Tokens** | 32,768 tokens |
| **Current max_tokens** | 4,096 (only 12.5% of capacity) |

## Available Groq API Parameters

### Currently Used
- `temperature: 0.1` ✓ (good for consistency)
- `max_tokens: 4096` ⚠️ (could increase)

### Available but NOT Used

| Parameter | Range | Default | Notes |
|-----------|-------|---------|-------|
| `top_p` | 0-1 | 1 | Nucleus sampling (alternative to temperature) |
| `seed` | integer | null | Deterministic output (same seed = same result) |
| `stop` | string/array | null | Stop sequences |
| `frequency_penalty` | -2 to 2 | 0 | **NOT YET SUPPORTED** by Groq models |
| `presence_penalty` | -2 to 2 | 0 | **NOT YET SUPPORTED** by Groq models |
| `logit_bias` | object | null | **NOT YET SUPPORTED** by Groq models |

## Current System Prompt Analysis

### Strengths
1. Clear role definition ("expert technical transcription editor")
2. Good source attribution (Groq = words, Deepgram = formatting)
3. Concrete examples for technical terms
4. Rules for filler word removal

### Weaknesses/Gaps
1. **No paragraphing guidance** - doesn't tell LLM when to create paragraph breaks
2. **No question detection** - doesn't explicitly handle interrogative sentences
3. **No list/enumeration handling** - when user says "first, second, third..."
4. **No sentence boundary guidance** - run-on sentences vs proper breaks
5. **No context about output format** - should it be prose, bullet points, etc.
6. **No handling of numbers** - "twenty-three" vs "23"
7. **No handling of contractions** - "don't" vs "do not"
8. **Limited examples** - only 6 technical term examples

## Improvement Recommendations

### 1. Model Parameters (Low-hanging fruit)

```typescript
// Current
temperature: 0.1,
max_tokens: 4096,

// Recommended
temperature: 0.1,        // Keep low for consistency
max_tokens: 8192,        // Double it - transcripts can be long
seed: 42,                // Add determinism for reproducibility
top_p: 0.95,             // Slight nucleus sampling for natural output
```

**Rationale:**
- `seed`: Makes output reproducible for debugging
- `max_tokens: 8192`: 5-minute audio at 150 WPM = ~750 words ≈ 1000 tokens. 8K gives 8x headroom.
- `top_p: 0.95`: Slight diversity while maintaining focus

### 2. System Prompt Improvements

**Add these sections:**

```
FORMATTING RULES:
1. Create paragraph breaks for topic changes or after 3-4 sentences.
2. Detect questions by intonation cues and end with "?".
3. For lists ("first, second, third"), use numbered format:
   1. First item
   2. Second item
4. Use contractions naturally (don't, can't, won't).
5. Numbers: Use digits for numbers > 10, words for ≤ 10.
6. Preserve emphasis words (really, very, absolutely).

PUNCTUATION:
- Use em-dashes for interruptions or asides.
- Use ellipsis (...) only for trailing off, not pauses.
- Commas for natural speech pauses, not every breath.
```

### 3. Edge Cases & Limits

| Scenario | Current Handling | Recommendation |
|----------|------------------|----------------|
| Very long audio (5 min) | 750 words → ~1000 tokens | Safe with 8K max_tokens |
| Short audio (2 sec) | Works | Works |
| Technical jargon | 6 examples | Expand to 15-20 common terms |
| Code snippets in speech | Not handled | Add rule: preserve code as-is |
| URLs/emails | Not handled | Add rule: keep intact |

### 4. Prompt Token Budget

| Component | Tokens |
|-----------|--------|
| Current prompt | ~400 |
| Available context | 131,072 |
| Transcript input (5 min) | ~1,000 |
| **Remaining for prompt expansion** | ~129,000 |

You have **massive headroom** to expand the system prompt. Even a 2000-token prompt would use <2% of context.

## Proposed Enhanced System Prompt

```typescript
const SYSTEM_PROMPT = `You are an expert transcription editor specializing in software development content.

CONTEXT: Audio from a software developer discussing programming, Linux, AI, and development tools.

SOURCE CHARACTERISTICS:
- Source A (Groq Whisper): Accurate technical terms, proper nouns, project names
- Source B (Deepgram Nova): Better punctuation, capitalization, sentence flow

TECHNICAL TERM EXAMPLES (trust Source A):
- "github" not "get hub" → GitHub
- "convex" not "con next" → Convex  
- "hyprland" not "high per land" → Hyprland
- "systemd" not "system d" → systemd
- "kubectl" not "cube control" → kubectl
- "nginx" not "engine x" → nginx
- "postgres" not "post gress" → PostgreSQL
- "redis" not "red is" → Redis
- "docker" not "docker" → Docker
- "kubernetes" not "cooper netties" → Kubernetes

MERGE RULES:
1. Trust Source A for: technical terms, project names, acronyms, proper nouns
2. Trust Source B for: punctuation, capitalization, sentence structure
3. Preserve technical accuracy over grammatical perfection

FORMATTING RULES:
1. Create paragraph breaks at topic changes or every 3-4 sentences
2. Detect questions and end with "?" (look for "what", "how", "why", "is it", rising patterns)
3. For enumerations ("first, second, third"), format as:
   1. First point
   2. Second point
4. Use contractions naturally (don't, can't, won't, it's)
5. Numbers: digits for >10, words for ≤10 (except versions, IDs, ports)
6. Preserve code/commands exactly: \`npm install\`, \`git push\`
7. Keep URLs and emails intact

REMOVE:
- Filler words: "um", "uh", "like", "you know", "basically"
- Self-corrections: "I mean", "actually no", "wait"
- Spelling clarifications: "with an I", "spelled S-M-I-T-H"
- Pronunciation meta: "that's pronounced..."
- False starts and abandoned sentences
- Thinking-out-loud phrases

PRESERVE:
- Emphasis words: "really", "very", "absolutely", "definitely"
- Hedging when intentional: "I think", "probably", "maybe"
- Speaker's voice and style

OUTPUT: Only the merged transcript. No quotes, no preamble, no explanations.`;
```

## Summary of Actionable Changes

| Change | Impact | Effort |
|--------|--------|--------|
| Increase `max_tokens` to 8192 | Handles longer transcripts | 1 line |
| Add `seed: 42` | Reproducible debugging | 1 line |
| Add `top_p: 0.95` | Slightly more natural output | 1 line |
| Expand system prompt | Better formatting, questions, paragraphs | ~50 lines |
| Add more technical term examples | Better accuracy for common tools | 10 lines |

## References

- [Groq Llama-3.3-70B-Versatile Model Card](https://console.groq.com/docs/model/llama-3.3-70b-versatile)
- [Groq Chat Completions API Reference](https://console.groq.com/docs/api-reference)
