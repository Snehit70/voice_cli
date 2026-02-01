use crate::ipc::AmplitudeMessage;
use crate::render;
use crate::waveform::WaveformState;
use anyhow::Result;
use layershellev::reexport::*;
use layershellev::{DispatchMessage, LayerShellEvent, ReturnData, WindowState};
use std::fs::File;
use std::os::fd::AsFd;
use tiny_skia::Pixmap;
use tokio::sync::mpsc;

const OVERLAY_WIDTH: u32 = 800;
const OVERLAY_HEIGHT: u32 = 60;
const MARGIN_TOP: i32 = 20;

pub fn run(mut rx: mpsc::Receiver<AmplitudeMessage>) -> Result<()> {
    let mut waveform_state = WaveformState::new();
    let mut pixmap = Pixmap::new(OVERLAY_WIDTH, OVERLAY_HEIGHT).unwrap();

    let ev: WindowState<()> = WindowState::new("voice-cli-overlay")
        .with_size((OVERLAY_WIDTH, OVERLAY_HEIGHT))
        .with_layer(Layer::Overlay)
        .with_anchor(Anchor::Top | Anchor::Left | Anchor::Right)
        .with_margin((0, 0, MARGIN_TOP, 0))
        .with_exclusive_zone(-1)
        .build()
        .unwrap();

    ev.running(move |event, _ev, _index| {
        // Check for new amplitude data (non-blocking)
        while let Ok(msg) = rx.try_recv() {
            waveform_state.update(msg.amplitude, msg.recording);
        }

        match event {
            LayerShellEvent::InitRequest => ReturnData::RequestBind,

            LayerShellEvent::BindProvide(_globals, _qh) => ReturnData::None,

            LayerShellEvent::RequestBuffer(file, shm, qh, init_w, init_h) => {
                println!("[Window] RequestBuffer: {}x{}", init_w, init_h);

                // Render waveform to pixmap
                render::draw_waveform(&mut pixmap, &waveform_state, init_w, init_h);

                // Write pixmap data to shared memory
                write_pixmap_to_file(&pixmap, &file, init_w, init_h);

                // Create Wayland buffer
                let pool = shm.create_pool(file.as_fd(), (init_w * init_h * 4) as i32, qh, ());

                ReturnData::WlBuffer(pool.create_buffer(
                    0,
                    init_w as i32,
                    init_h as i32,
                    (init_w * 4) as i32,
                    wl_shm::Format::Argb8888,
                    qh,
                    (),
                ))
            }

            LayerShellEvent::RequestMessages(DispatchMessage::RequestRefresh { .. }) => {
                // Just acknowledge refresh, no need to redraw
                ReturnData::None
            }

            LayerShellEvent::RequestMessages(DispatchMessage::MouseButton { .. }) => {
                // Ignore mouse events
                ReturnData::None
            }

            _ => ReturnData::None,
        }
    })
    .map_err(|e| anyhow::anyhow!("Window error: {:?}", e))
}

fn write_pixmap_to_file(pixmap: &Pixmap, file: &File, width: u32, height: u32) {
    use std::os::unix::io::AsRawFd;

    let fd = file.as_raw_fd();
    let data = pixmap.data();

    unsafe {
        let ptr = libc::mmap(
            std::ptr::null_mut(),
            (width * height * 4) as usize,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_SHARED,
            fd,
            0,
        );

        if ptr == libc::MAP_FAILED {
            eprintln!("[Window] mmap failed");
            return;
        }

        std::ptr::copy_nonoverlapping(data.as_ptr(), ptr as *mut u8, (width * height * 4) as usize);

        libc::munmap(ptr, (width * height * 4) as usize);
    }
}
