import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { notify } from "../output/notification";
import { logger } from "../utils/logger";

export class DaemonSupervisor {
	private restartCount = 0;
	private firstRestartTime = 0;
	private readonly MAX_RESTARTS = 3;
	private readonly WINDOW_MS = 5 * 60 * 1000;
	private isStopping = false;

	constructor(private scriptPath: string) {}

	public start() {
		this.spawnDaemon();
	}

	public stop() {
		this.isStopping = true;
	}

	private spawnDaemon() {
		if (this.isStopping) return;

		logger.info("Supervisor: Spawning daemon process...");

		const child = spawn(
			"bun",
			["run", this.scriptPath, "start", "--daemon-worker"],
			{
				stdio: "inherit",
				env: { ...process.env, VOICE_CLI_DAEMON_WORKER: "true" },
			},
		);

		child.on("exit", (code, signal) => {
			if (this.isStopping || code === 0) {
				logger.info(
					`Supervisor: Daemon exited cleanly (code: ${code}, signal: ${signal})`,
				);
				return;
			}

			logger.error(
				`Supervisor: Daemon crashed (code: ${code}, signal: ${signal})`,
			);
			this.handleCrash();
		});
	}

	private handleCrash() {
		const now = Date.now();

		if (now - this.firstRestartTime > this.WINDOW_MS) {
			this.restartCount = 1;
			this.firstRestartTime = now;
		} else {
			this.restartCount++;
		}

		if (this.restartCount > this.MAX_RESTARTS) {
			const msg = `Daemon crashed ${this.MAX_RESTARTS} times in 5 minutes. Stopping.`;
			logger.error(msg);

			const configDir = join(homedir(), ".config", "voice-cli");
			const stateFile = join(configDir, "daemon.state");
			const pidFile = join(configDir, "daemon.pid");

			if (existsSync(stateFile)) {
				try {
					const state = JSON.parse(readFileSync(stateFile, "utf-8"));
					state.status = "error";
					state.lastError = msg;
					writeFileSync(stateFile, JSON.stringify(state, null, 2));
				} catch (_e) {}
			}

			if (existsSync(pidFile)) {
				try {
					unlinkSync(pidFile);
				} catch (_e) {}
			}

			notify("Daemon Critical Failure", msg, "error");
			process.exit(1);
		}

		logger.warn(
			`Supervisor: Restarting daemon (${this.restartCount}/${this.MAX_RESTARTS})...`,
		);
		setTimeout(() => this.spawnDaemon(), 1000);
	}
}
