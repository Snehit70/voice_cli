import {
	type ConfigLoadResult,
	clearConfigCache,
	DEFAULT_CONFIG_FILE,
	loadConfig,
	reloadConfig,
} from "./loader";
import type { Config } from "./schema";

class ConfigService {
	private config: Config | null = null;

	get(): Config {
		if (!this.config) {
			this.config = loadConfig();
		}
		return this.config;
	}

	reload(path: string = DEFAULT_CONFIG_FILE): ConfigLoadResult {
		const result = reloadConfig(path);
		if (result.success && result.config) {
			this.config = result.config;
		}
		return result;
	}

	clear(): void {
		this.config = null;
		clearConfigCache();
	}
}

export const configService = new ConfigService();
