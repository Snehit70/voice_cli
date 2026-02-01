mod ipc;
mod render;
mod waveform;
mod window;

use anyhow::Result;
use std::env;
use tokio::sync::mpsc;

const DEFAULT_SOCKET_PATH: &str = "/tmp/voice-cli-overlay.sock";

#[tokio::main]
async fn main() -> Result<()> {
    // Parse command line arguments
    let socket_path = env::args()
        .nth(1)
        .unwrap_or_else(|| DEFAULT_SOCKET_PATH.to_string());

    println!("[Overlay] Starting voice-cli overlay");
    println!("[Overlay] Socket path: {}", socket_path);

    // Create channel for IPC -> Window communication
    let (tx, rx) = mpsc::channel(100);

    // Spawn IPC listener in background
    let ipc_handle = tokio::spawn(async move {
        if let Err(e) = ipc::listen(&socket_path, tx).await {
            eprintln!("[Overlay] IPC error: {}", e);
        }
    });

    // Run window on main thread (Wayland requires this)
    window::run(rx)?;

    // Wait for IPC task to finish
    ipc_handle.await?;

    println!("[Overlay] Shutting down");
    Ok(())
}
