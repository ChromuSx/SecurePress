export type ActionType = 'program' | 'hotkey' | 'script' | 'http' | 'text' | 'sequence';
export type ScriptType = 'powershell' | 'batch' | 'python';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type TextMode = 'paste' | 'type';

export interface Settings {
  actionType?: ActionType;

  // Program execution
  programPath?: string;
  programArgs?: string;
  workingDirectory?: string;

  // Hotkey simulation
  hotkeyKeys?: string;

  // Script execution
  scriptType?: ScriptType;
  scriptContent?: string;

  // HTTP request
  httpUrl?: string;
  httpMethod?: HttpMethod;
  httpBody?: string;
  httpHeaders?: string;
  httpShowResponse?: boolean;

  // Text input
  textContent?: string;
  textMode?: TextMode;
  textPressEnter?: boolean;

  // Sequence
  sequenceActions?: Array<any>;

  // Authentication options
  requireAuthEveryTime?: boolean;
  sessionDurationMinutes?: number;

  // DPAPI-backed fields stored outside Stream Deck settings.
  secureSecretRefs?: Record<string, string>;
}
