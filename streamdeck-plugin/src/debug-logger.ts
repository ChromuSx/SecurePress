import * as fs from 'fs';
import * as path from 'path';

const logFilePath = path.join(process.env.TEMP || 'C:\\Temp', 'securepress-debug.log');

const SENSITIVE_KEYS = new Set([
  'authorization',
  'body',
  'cookie',
  'headers',
  'httpbody',
  'httpheaders',
  'password',
  'programargs',
  'scriptcontent',
  'secret',
  'securesecretrefs',
  'sequenceactions',
  'textcontent',
  'token',
]);

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.has(normalized) ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('authorization');
}

export function sanitizeForLog(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = shouldRedactKey(key) ? '[REDACTED]' : sanitizeForLog(nestedValue, seen);
  }

  return sanitized;
}

export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const serializedData = data ? JSON.stringify(sanitizeForLog(data), null, 2) : '';
  const logLine = `[${timestamp}] ${message}${serializedData ? ' | ' + serializedData : ''}\n`;

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
