use anyhow::{Context, Result};
use serde::Deserialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UnixStream;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};

#[derive(Debug, Deserialize)]
pub struct AmplitudeMessage {
    pub amplitude: f32,
    pub recording: bool,
}

pub async fn listen(socket_path: &str, tx: mpsc::Sender<AmplitudeMessage>) -> Result<()> {
    loop {
        match connect_and_read(socket_path, tx.clone()).await {
            Ok(_) => {
                println!("[IPC] Connection closed gracefully");
            }
            Err(e) => {
                eprintln!("[IPC] Error: {}. Retrying in 2s...", e);
                sleep(Duration::from_secs(2)).await;
            }
        }
    }
}

async fn connect_and_read(socket_path: &str, tx: mpsc::Sender<AmplitudeMessage>) -> Result<()> {
    println!("[IPC] Connecting to {}", socket_path);
    
    let stream = UnixStream::connect(socket_path)
        .await
        .context("Failed to connect to Unix socket")?;

    println!("[IPC] Connected successfully");

    let reader = BufReader::new(stream);
    let mut lines = reader.lines();

    while let Some(line) = lines.next_line().await? {
        match serde_json::from_str::<AmplitudeMessage>(&line) {
            Ok(msg) => {
                if tx.send(msg).await.is_err() {
                    eprintln!("[IPC] Receiver dropped, shutting down");
                    break;
                }
            }
            Err(e) => {
                eprintln!("[IPC] Failed to parse message: {} (line: {})", e, line);
            }
        }
    }

    Ok(())
}
