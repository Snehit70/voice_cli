# Waveform Overlay Mockup

Animated waveform overlay for voice-cli using GTK4 Layer Shell.

## Requirements

```bash
# Fedora
sudo dnf install gtk4 gtk4-layer-shell python3-gobject

# Arch
sudo pacman -S gtk4 gtk4-layer-shell python-gobject

# Ubuntu (may need PPA)
sudo apt install gtk4-layer-shell python3-gi
```

## Run

```bash
cd /home/snehit/projects/voice-cli/mockup
python3 waveform_overlay.py
```

## Options

```bash
python3 waveform_overlay.py --width 500 --height 60 --bars 50 --fps 60
```

| Option | Default | Description |
|--------|---------|-------------|
| `--width` | 400 | Overlay width in pixels |
| `--height` | 50 | Overlay height in pixels |
| `--bars` | 40 | Number of waveform bars |
| `--fps` | 30 | Animation frames per second |

## Design Notes

- **Position**: Center-bottom of screen
- **Layer**: OVERLAY (above all windows)
- **Exclusive zone**: -1 (windows render underneath, no space reserved)
- **Style**: Rounded bars with green→yellow→red gradient

## Exit

Press `Ctrl+C` or close the window.
