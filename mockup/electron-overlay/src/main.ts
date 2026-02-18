import * as path from "node:path";
import {
	app,
	BrowserWindow,
	type BrowserWindowConstructorOptions,
	ipcMain,
	screen,
} from "electron";

interface OverlayConfig {
	width: number;
	height: number;
	marginBottom: number;
}

const DEFAULT_CONFIG: OverlayConfig = {
	width: 400,
	height: 60,
	marginBottom: 80,
};

let mainWindow: BrowserWindow | null = null;

function createOverlayWindow(
	config: OverlayConfig = DEFAULT_CONFIG,
): BrowserWindow {
	const { width: screenWidth, height: screenHeight } =
		screen.getPrimaryDisplay().workAreaSize;

	const windowOptions: BrowserWindowConstructorOptions = {
		width: config.width,
		height: config.height,
		x: Math.floor((screenWidth - config.width) / 2),
		y: screenHeight - config.height - config.marginBottom,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: false,
		skipTaskbar: true,
		hasShadow: false,
		focusable: false,
		type: "toolbar",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.js"),
		},
	};

	const window = new BrowserWindow(windowOptions);

	window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
	window.setAlwaysOnTop(true, "floating");

	window.loadFile(path.join(__dirname, "renderer", "index.html"));

	return window;
}

app.whenReady().then(() => {
	mainWindow = createOverlayWindow();

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	ipcMain.on("window-ready", () => {
		console.log("Overlay window ready");
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		mainWindow = createOverlayWindow();
	}
});

app.on("before-quit", () => {
	if (mainWindow !== null && !mainWindow.isDestroyed()) {
		mainWindow.close();
	}
});
