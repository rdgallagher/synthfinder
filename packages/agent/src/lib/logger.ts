import { appendFileSync } from "node:fs";

export interface Logger {
  log: (message: string) => void;
}

function nowHHMMSS(): string {
  return new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
}

export function createLogger(logPath: string): Logger {
  return {
    log(message: string): void {
      const line = `[${nowHHMMSS()}] ${message}\n`;
      process.stdout.write(line);
      appendFileSync(logPath, line);
    },
  };
}
