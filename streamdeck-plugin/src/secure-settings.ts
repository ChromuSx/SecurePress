import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cleanupTempDir, createTempScript, escapePowerShellSingleQuotedString } from './action-utils';
import { Settings } from './types';

const execFileAsync = promisify(execFile);

export const SENSITIVE_SETTING_KEYS = [
  'programArgs',
  'scriptContent',
  'httpBody',
  'httpHeaders',
  'textContent',
  'sequenceActions',
] as const;

type SensitiveSettingKey = typeof SENSITIVE_SETTING_KEYS[number];

const REF_PREFIX = 'dpapi:v1:';

export class SecureSettingsStorage {
  private readonly storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'SecurePress',
      'secrets'
    );
  }

  public async sanitizeForPersistence(context: string, settings: Settings, previousSettings: Settings = {}): Promise<Settings> {
    const mergedRefs = {
      ...(previousSettings.secureSecretRefs || {}),
      ...(settings.secureSecretRefs || {}),
    };
    const sanitized: Settings = {
      ...settings,
      secureSecretRefs: mergedRefs,
    };

    for (const key of SENSITIVE_SETTING_KEYS) {
      const rawValue = (settings as any)[key];
      const hasIncomingValue = Object.prototype.hasOwnProperty.call(settings, key);

      if (hasIncomingValue) {
        const serialized = serializeSensitiveValue(key, rawValue);
        if (serialized.length > 0) {
          sanitized.secureSecretRefs![key] = await this.storeValue(context, key, serialized, mergedRefs[key]);
        } else if (mergedRefs[key]) {
          this.deleteRef(mergedRefs[key]);
          delete sanitized.secureSecretRefs![key];
        }
      }

      delete (sanitized as any)[key];
    }

    if (!sanitized.secureSecretRefs || Object.keys(sanitized.secureSecretRefs).length === 0) {
      delete sanitized.secureSecretRefs;
    }

    return sanitized;
  }

  public async materialize(settings: Settings): Promise<Settings> {
    const materialized: Settings = { ...settings };
    const refs = settings.secureSecretRefs || {};

    for (const key of SENSITIVE_SETTING_KEYS) {
      const ref = refs[key];
      if (!ref) {
        continue;
      }

      const value = await this.readValue(ref);
      (materialized as any)[key] = deserializeSensitiveValue(key, value);
    }

    return materialized;
  }

  private async storeValue(context: string, key: SensitiveSettingKey, value: string, existingRef?: string): Promise<string> {
    fs.mkdirSync(this.storageDir, { recursive: true });

    const ref = existingRef && existingRef.startsWith(REF_PREFIX)
      ? existingRef
      : `${REF_PREFIX}${this.hashRef(context, key)}`;

    const targetPath = this.getPathForRef(ref);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securepress-secret-'));
    const inputPath = path.join(tempDir, 'plain.txt');
    const scriptPath = path.join(tempDir, 'protect.ps1');

    try {
      fs.writeFileSync(inputPath, value, 'utf8');
      fs.writeFileSync(scriptPath, this.getDpapiScript('protect', inputPath, targetPath), 'utf8');
      await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
        timeout: 10000,
        windowsHide: true,
      });
      return ref;
    } finally {
      cleanupTempDir(tempDir);
    }
  }

  private async readValue(ref: string): Promise<string> {
    const secretPath = this.getPathForRef(ref);
    if (!fs.existsSync(secretPath)) {
      return '';
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securepress-secret-'));
    const outputPath = path.join(tempDir, 'plain.txt');
    const temp = createTempScript('securepress-secret', 'ps1', this.getDpapiScript('unprotect', secretPath, outputPath));

    try {
      await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', temp.filePath], {
        timeout: 10000,
        windowsHide: true,
      });
      return fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    } finally {
      cleanupTempDir(temp.dir);
      cleanupTempDir(tempDir);
    }
  }

  private deleteRef(ref: string) {
    try {
      const secretPath = this.getPathForRef(ref);
      fs.rmSync(secretPath, { force: true });
    } catch {
      // Best effort cleanup only.
    }
  }

  private hashRef(context: string, key: string): string {
    return createHash('sha256')
      .update(`SecurePress:${context}:${key}`)
      .digest('hex');
  }

  private getPathForRef(ref: string): string {
    if (!ref.startsWith(REF_PREFIX)) {
      throw new Error('Unsupported secure settings reference');
    }

    const hash = ref.substring(REF_PREFIX.length);
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error('Invalid secure settings reference');
    }

    return path.join(this.storageDir, `${hash}.bin`);
  }

  private getDpapiScript(mode: 'protect' | 'unprotect', inputPath: string, outputPath: string): string {
    const escapedInput = escapePowerShellSingleQuotedString(inputPath);
    const escapedOutput = escapePowerShellSingleQuotedString(outputPath);

    if (mode === 'protect') {
      return `
Add-Type -AssemblyName System.Security
$plain = [System.IO.File]::ReadAllText('${escapedInput}', [System.Text.Encoding]::UTF8)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.IO.File]::WriteAllBytes('${escapedOutput}', $protected)
      `.trim();
    }

    return `
Add-Type -AssemblyName System.Security
$protected = [System.IO.File]::ReadAllBytes('${escapedInput}')
$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
$plain = [System.Text.Encoding]::UTF8.GetString($bytes)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText('${escapedOutput}', $plain, $utf8NoBom)
    `.trim();
  }
}

function serializeSensitiveValue(key: SensitiveSettingKey, value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (key === 'sequenceActions') {
    return Array.isArray(value) ? JSON.stringify(value) : String(value);
  }

  return String(value);
}

function deserializeSensitiveValue(key: SensitiveSettingKey, value: string): unknown {
  if (key !== 'sequenceActions') {
    return value;
  }

  if (!value.trim()) {
    return [];
  }

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}
