import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export interface ProcessErrorDetails {
  message: string;
  code?: string | number;
  signal?: string;
  stdout?: string;
  stderr?: string;
}

export interface ParsedHotkey {
  modifiers: string[];
  mainKey: string;
}

const keyAliases: Record<string, string> = {
  return: 'ENTER',
  escape: 'ESC',
  del: 'DELETE',
  pgup: 'PAGEUP',
  pgdn: 'PAGEDOWN',
  windows: 'LWIN',
  win: 'LWIN',
};

const supportedMainKeyPattern =
  /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|TAB|ENTER|ESC|SPACE|BACKSPACE|DELETE|HOME|END|PAGEUP|PAGEDOWN|UP|DOWN|LEFT|RIGHT)$/;

export function truncateForLog(value: unknown, maxLength: number = 300): string {
  const text = String(value ?? '');
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getProcessErrorDetails(error: any): ProcessErrorDetails {
  return {
    message: toErrorMessage(error),
    code: error?.code,
    signal: error?.signal,
    stdout: error?.stdout ? truncateForLog(error.stdout) : undefined,
    stderr: error?.stderr ? truncateForLog(error.stderr) : undefined,
  };
}

export function parseArgumentString(args: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < args.length; i++) {
    const char = args[i];

    if (char === '\\' && args[i + 1] === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && /\s/.test(char)) {
      if (current.length > 0) {
        result.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new Error('Program arguments contain an unclosed quote');
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}

export function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}

export function createTempScript(prefix: string, extension: string, content: string): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const filePath = path.join(dir, `script.${extension}`);
  fs.writeFileSync(filePath, content, 'utf8');
  return { dir, filePath };
}

export function cleanupTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup only.
  }
}

export async function runPowerShellScript(script: string, prefix: string, timeout: number) {
  const temp = createTempScript(prefix, 'ps1', script);
  try {
    return await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', temp.filePath],
      { timeout, windowsHide: true }
    );
  } finally {
    cleanupTempDir(temp.dir);
  }
}

export function parseHotkeyKeys(hotkeyKeys: string): ParsedHotkey {
  const parts = hotkeyKeys.split('+').map(p => p.trim().toLowerCase()).filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Hotkey keys are required');
  }

  const modifiers: string[] = [];
  let mainKey = '';

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') {
      modifiers.push('CTRL');
    } else if (part === 'alt') {
      modifiers.push('ALT');
    } else if (part === 'shift') {
      modifiers.push('SHIFT');
    } else if (part === 'win' || part === 'windows') {
      modifiers.push('LWIN');
    } else {
      if (mainKey) {
        throw new Error('Hotkey can only contain one main key');
      }
      mainKey = keyAliases[part] || part.toUpperCase();
    }
  }

  if (!supportedMainKeyPattern.test(mainKey)) {
    throw new Error(`Unsupported hotkey key: ${mainKey || '(missing)'}`);
  }

  return { modifiers, mainKey };
}
