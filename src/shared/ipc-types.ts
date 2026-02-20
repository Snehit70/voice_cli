export type DaemonStatus =
	| "idle"
	| "starting"
	| "recording"
	| "stopping"
	| "processing"
	| "error";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface DaemonState {
	status: DaemonStatus;
	lastTranscription?: string;
	error?: string;
	timestamp?: number;
}

export interface IPCMessage {
	type: "hello" | "state";
	version?: number;
	status?: DaemonStatus;
	lastTranscription?: string;
	error?: string;
	timestamp?: number;
}
