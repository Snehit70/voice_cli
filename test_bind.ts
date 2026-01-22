import { GlobalKeyboardListener } from "node-global-key-listener";

const listener = new GlobalKeyboardListener();

try {
    console.log("Attempting to listen...");
    // Bind to a common key
    listener.addListener((e, down) => {
        console.log("Key event:", e.name);
    });
    console.log("Listener added.");
    
    // Keep alive for a moment
    setTimeout(() => {
        console.log("Stopping...");
        listener.kill();
    }, 2000);
} catch (err) {
    console.error("Caught error:", err);
}
