import { Command } from "commander";
import { loadHistory, clearHistory } from "../utils/history";
import * as colors from "yoctocolors";

export const historyCommand = new Command("history")
  .description("Display transcription history");

historyCommand
  .command("list")
  .description("List recent transcriptions")
  .option("-n, --number <count>", "Number of items to show", "10")
  .action((options) => {
    const history = loadHistory();
    if (history.length === 0) {
      console.log(colors.yellow("No transcription history found."));
      return;
    }

    const count = parseInt(options.number, 10);
    const recent = history.slice(-count);

    console.log(colors.bold(colors.cyan(`Last ${recent.length} transcription(s):`)));
    recent.forEach((item) => {
      console.log(colors.dim("------------------------------------------------"));
      console.log(`${colors.bold("Time:")}    ${new Date(item.timestamp).toLocaleString()}`);
      console.log(`${colors.bold("Engine:")}  ${item.engine} (${item.processingTime}ms)`);
      console.log(`${colors.bold("Length:")}  ${item.duration.toFixed(1)}s`);
      console.log(`${colors.bold("Text:")}    ${colors.green(item.text)}`);
    });
    console.log(colors.dim("------------------------------------------------"));
  });

historyCommand
  .command("clear")
  .description("Clear all transcription history")
  .action(() => {
    clearHistory();
    console.log(colors.green("✅ Transcription history cleared."));
  });
