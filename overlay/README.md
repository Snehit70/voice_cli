# Electron Waveform Overlay

Transparent, always-on-top waveform overlay for hyprvox using Electron.

## Features

- **Transparent window** - Blends with desktop
- **Always on top** - Stays above all windows
- **Center-bottom positioning** - Like Google Assistant/Siri
- **Live microphone input** - Real-time audio visualization
- **Static mode** - Mirrored bars from center
- **Fade edges** - Smooth gradient at edges
- **Strict TypeScript** - Full type safety

## Requirements

```bash
# Install dependencies
npm install
# or
bun install
```

## Hyprland Configuration (REQUIRED for Wayland)

For the overlay to work properly on Hyprland, add these window rules to your config.

**Edit `~/.config/hypr/UserConfigs/WindowRules.conf`:**

```conf
# Hyprvox Overlay
windowrule = match:class hyprvox-overlay, float on
windowrule = match:class hyprvox-overlay, pin on
windowrule = match:class hyprvox-overlay, no_focus on
windowrule = match:class hyprvox-overlay, no_shadow on
windowrule = match:class hyprvox-overlay, no_anim on
```

After adding the rules, reload Hyprland:
```bash
hyprctl reload
```

### Syntax Notes (Hyprland 0.53+)

**Correct syntax:** `windowrule = match:<criteria>, <effect> <value>`

```conf
# CORRECT
windowrule = match:class hyprvox-overlay, pin on

# WRONG - old windowrulev2 syntax (deprecated)
windowrulev2 = pin, class:^(hyprvox-overlay)$

# WRONG - effect before match
windowrule = pin on, match:class hyprvox-overlay
```

**Rule explanations:**

| Rule | Purpose |
|------|---------|
| `float on` | Make it a floating window |
| `pin on` | Show on all workspaces |
| `no_focus on` | Prevent overlay from receiving focus |
| `no_shadow on` | Remove drop shadow |
| `no_anim on` | Disable open/close animations |

## Build & Run

```bash
# Build TypeScript
npm run build

# Start overlay
npm start
```

## Project Structure

```text
overlay/
├── src/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Context bridge for IPC
│   └── renderer/
│       ├── index.html   # Overlay UI
│       ├── App.tsx      # Main React component
│       └── LiveWaveform.tsx  # Canvas waveform with mic input
├── package.json
└── tsconfig.json        # Strict TypeScript config
```

## Configuration

Edit `src/main.ts` to change:

| Setting | Default | Description |
|---------|---------|-------------|
| `width` | 400 | Overlay width in pixels |
| `height` | 60 | Overlay height in pixels |
| `marginBottom` | 80 | Distance from bottom of screen |

## Waveform Options

Edit `src/renderer/App.tsx` to change:

| Option | Default | Description |
|--------|---------|-------------|
| `barWidth` | 3 | Width of each bar |
| `barGap` | 2 | Gap between bars |
| `barRadius` | 1.5 | Corner radius of bars |
| `barColor` | white | Color of bars |
| `fadeEdges` | true | Fade effect at edges |
| `mode` | static | "static" or "scrolling" |

## Notes

- Uses Web Audio API for real-time microphone visualization
- IPC integration with hyprvox daemon is built-in (daemon broadcasts state via Unix socket)
- Wayland support requires Hyprland window rules (see above)
