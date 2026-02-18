import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
	onToggleListening: (callback: () => void): (() => void) => {
		const handler = (): void => callback();
		ipcRenderer.on("toggle-listening", handler);
		return () => ipcRenderer.removeListener("toggle-listening", handler);
	},
	notifyReady: (): void => {
		ipcRenderer.send("window-ready");
	},
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
