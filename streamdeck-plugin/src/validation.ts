import * as fs from 'fs';
import * as path from 'path';
import { parseHotkeyKeys } from './action-utils';
import { ActionType, HttpMethod, ScriptType, Settings, TextMode } from './types';

const actionTypes = new Set<ActionType>(['program', 'hotkey', 'script', 'http', 'text', 'sequence']);
const scriptTypes = new Set<ScriptType>(['powershell', 'batch', 'python']);
const httpMethods = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'DELETE']);
const textModes = new Set<TextMode>(['paste', 'type']);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSettings(settings: Settings): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const actionType = settings.actionType || 'program';

  if (!actionTypes.has(actionType)) {
    errors.push(`Unsupported action type: ${String(actionType)}`);
    return { valid: false, errors, warnings };
  }

  validateAuthSettings(settings, errors);

  switch (actionType) {
    case 'program':
      validateProgramSettings(settings, errors, warnings);
      break;
    case 'hotkey':
      validateHotkeySettings(settings, errors);
      break;
    case 'script':
      validateScriptSettings(settings, errors);
      break;
    case 'http':
      validateHttpSettings(settings, errors, warnings);
      break;
    case 'text':
      validateTextSettings(settings, errors);
      break;
    case 'sequence':
      validateSequenceSettings(settings, errors, warnings);
      break;
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateAuthSettings(settings: Settings, errors: string[]) {
  if (settings.sessionDurationMinutes === undefined || settings.requireAuthEveryTime) {
    return;
  }

  const duration = Number(settings.sessionDurationMinutes);
  if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
    errors.push('Session duration must be between 1 and 60 minutes');
  }
}

function validateProgramSettings(settings: Settings, errors: string[], warnings: string[]) {
  const programPath = settings.programPath?.trim();
  if (!programPath) {
    errors.push('Program path is required');
    return;
  }

  const hasPathSeparator = programPath.includes('\\') || programPath.includes('/');
  const executablePath = !path.isAbsolute(programPath) && settings.workingDirectory
    ? path.join(settings.workingDirectory, programPath)
    : programPath;

  if ((path.isAbsolute(programPath) || hasPathSeparator) && !fs.existsSync(executablePath)) {
    errors.push('Program path does not exist');
  }

  if (settings.workingDirectory) {
    try {
      const stat = fs.statSync(settings.workingDirectory);
      if (!stat.isDirectory()) {
        errors.push('Working directory must be a folder');
      }
    } catch {
      errors.push('Working directory does not exist');
    }
  }

  if (!path.extname(programPath) && !hasPathSeparator) {
    warnings.push('Program will be resolved from PATH');
  }
}

function validateHotkeySettings(settings: Settings, errors: string[]) {
  const hotkeyKeys = settings.hotkeyKeys?.trim();
  if (!hotkeyKeys) {
    errors.push('Hotkey keys are required');
    return;
  }

  try {
    parseHotkeyKeys(hotkeyKeys);
  } catch (error: any) {
    errors.push(error.message);
  }
}

function validateScriptSettings(settings: Settings, errors: string[]) {
  const scriptType = settings.scriptType || 'powershell';
  if (!scriptTypes.has(scriptType)) {
    errors.push(`Unsupported script type: ${String(scriptType)}`);
  }

  if (!settings.scriptContent?.trim()) {
    errors.push('Script content is required');
  }
}

function validateHttpSettings(settings: Settings, errors: string[], warnings: string[]) {
  const url = settings.httpUrl?.trim();
  const method = settings.httpMethod || 'GET';

  if (!url) {
    errors.push('HTTP URL is required');
  } else {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('HTTP URL must use http:// or https://');
      }
    } catch {
      errors.push('HTTP URL is not valid');
    }
  }

  if (!httpMethods.has(method)) {
    errors.push(`Unsupported HTTP method: ${String(method)}`);
  }

  if (settings.httpHeaders?.trim()) {
    try {
      const parsedHeaders = JSON.parse(settings.httpHeaders);
      if (!parsedHeaders || Array.isArray(parsedHeaders) || typeof parsedHeaders !== 'object') {
        errors.push('HTTP headers must be a JSON object');
      }
    } catch {
      errors.push('HTTP headers must be valid JSON');
    }
  }

  if (settings.httpBody?.trim() && method === 'GET') {
    warnings.push('HTTP body is ignored for GET requests');
  }
}

function validateTextSettings(settings: Settings, errors: string[]) {
  const textMode = settings.textMode || 'type';
  if (!textModes.has(textMode)) {
    errors.push(`Unsupported text input mode: ${String(textMode)}`);
  }

  if (!settings.textContent) {
    errors.push('Text content is required');
  }
}

function validateSequenceSettings(settings: Settings, errors: string[], warnings: string[]) {
  const sequenceActions = settings.sequenceActions;
  if (!Array.isArray(sequenceActions) || sequenceActions.length === 0) {
    errors.push('Sequence actions array is required');
    return;
  }

  sequenceActions.forEach((action, index) => {
    if (!action || typeof action !== 'object') {
      errors.push(`Sequence step ${index + 1} must be an object`);
      return;
    }

    if (action.type === 'delay') {
      const delayMs = Number(action.delayMs ?? 1000);
      if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > 300000) {
        errors.push(`Sequence step ${index + 1} delay must be between 0 and 300000 ms`);
      }
      return;
    }

    if (!actionTypes.has(action.type)) {
      errors.push(`Sequence step ${index + 1} has unsupported type: ${String(action.type)}`);
      return;
    }

    const nested = validateSettings({ ...action, actionType: action.type });
    nested.errors.forEach(error => errors.push(`Sequence step ${index + 1}: ${error}`));
    nested.warnings.forEach(warning => warnings.push(`Sequence step ${index + 1}: ${warning}`));
  });
}
