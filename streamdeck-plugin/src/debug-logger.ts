import * as fs from 'fs';
import * as path from 'path';

const logFilePath = path.join(process.env.TEMP || 'C:\\Temp', 'securepress-debug.log');

export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}${data ? ' | ' + JSON.stringify(data, null, 2) : ''}\n`;

  try {
    fs.appendFileSync(logFilePath, logLine);
  } catch (error) {
    console.error('Failed to write debug log:', error);
  }
}

export function getLogPath(): string {
  return logFilePath;
}

// Log startup
debugLog('=== SecurePress Plugin Started ===');
debugLog('Log file location: ' + logFilePath);
