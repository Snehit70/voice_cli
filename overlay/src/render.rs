use crate::waveform::WaveformState;
use tiny_skia::{Color, Paint, PathBuilder, Pixmap, Rect, Transform};

const OVERLAY_HEIGHT: u32 = 60;
const BAR_WIDTH: f32 = 6.0;
const BAR_SPACING: f32 = 2.0;
const MARGIN: f32 = 10.0;

pub fn draw_waveform(pixmap: &mut Pixmap, state: &WaveformState, width: u32, height: u32) {
    // Clear background with semi-transparent black
    pixmap.fill(Color::from_rgba8(0, 0, 0, 230));

    let history = state.get_history();
    if history.is_empty() {
        return;
    }

    let bar_total_width = BAR_WIDTH + BAR_SPACING;
    let available_width = width as f32 - (2.0 * MARGIN);
    let max_bars = (available_width / bar_total_width).floor() as usize;
    let num_bars = history.len().min(max_bars);

    // Start from the right side (most recent)
    let start_x = width as f32 - MARGIN - (num_bars as f32 * bar_total_width);

    for (i, &amplitude) in history.iter().rev().take(num_bars).enumerate() {
        let x = start_x + (i as f32 * bar_total_width);
        let bar_height = (amplitude * (height as f32 - 2.0 * MARGIN)).max(2.0);
        let y = (height as f32 - bar_height) / 2.0;

        // Color gradient: green -> yellow -> red
        let color = if amplitude < 0.5 {
            // Green to yellow
            let t = amplitude * 2.0;
            Color::from_rgba8((255.0 * t) as u8, 255, 0, 255)
        } else {
            // Yellow to red
            let t = (amplitude - 0.5) * 2.0;
            Color::from_rgba8(255, (255.0 * (1.0 - t)) as u8, 0, 255)
        };

        draw_rounded_rect(pixmap, x, y, BAR_WIDTH, bar_height, 2.0, color);
    }
}

fn draw_rounded_rect(
    pixmap: &mut Pixmap,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    _radius: f32,
    color: Color,
) {
    let mut paint = Paint::default();
    paint.set_color(color);
    paint.anti_alias = true;

    let mut pb = PathBuilder::new();

    // Simple rounded rectangle
    let rect = Rect::from_xywh(x, y, width, height).unwrap();
    pb.push_rect(rect);

    if let Some(path) = pb.finish() {
        pixmap.fill_path(
            &path,
            &paint,
            tiny_skia::FillRule::Winding,
            Transform::identity(),
            None,
        );
    }
}
