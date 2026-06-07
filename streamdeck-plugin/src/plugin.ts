import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as WebSocketLib from 'ws';
import { WindowsHelloAuth, AuthResult } from './windows-hello-auth';
import { debugLog } from './debug-logger';
import {
  cleanupTempDir,
  createTempScript,
  escapePowerShellSingleQuotedString,
  getProcessErrorDetails,
  parseArgumentString,
  parseHotkeyKeys,
  runPowerShellScript,
  toErrorMessage,
} from './action-utils';
import { SecureSettingsStorage } from './secure-settings';
import { Settings } from './types';
import { validateSettings } from './validation';

const execFileAsync = promisify(execFile);
const windowsHelloAuth = new WindowsHelloAuth();
const secureSettingsStorage = new SecureSettingsStorage();

debugLog('Plugin modules loaded');

// Settings interface for action configuration
interface ActionContext {
  action: string;
  context: string;
  device: string;
  payload: {
    settings: Settings;
    coordinates?: { column: number; row: number };
    state?: number;
    userDesiredState?: number;
    isInMultiAction?: boolean;
  };
}

let ws: WebSocketLib.WebSocket;
const settingsCache = new Map<string, Settings>();
const executionLock = new Map<string, boolean>();
const authSessionCache = new Map<string, number>(); // context -> timestamp of last auth

const pluginUUID = 'com.securepress.action';
const executeActionUUID = `${pluginUUID}.execute`;

// States: 0=Idle, 1=Authenticating, 2=Success, 3=Error
enum ActionState {
  Idle = 0,
  Authenticating = 1,
  Success = 2,
  Error = 3
}

function connectElgatoStreamDeckSocket(
  inPort: string,
  inPluginUUID: string,
  inRegisterEvent: string,
  inInfo: string
) {
  ws = new WebSocketLib.WebSocket(`ws://127.0.0.1:${inPort}`);

  ws.on('open', () => {
    const registerEvent = {
      event: inRegisterEvent,
      uuid: inPluginUUID,
    };
    ws.send(JSON.stringify(registerEvent));
    logMessage('SecurePress plugin connected');
  });

  ws.on('message', (data: string) => {
    const message = JSON.parse(data.toString());
    handleMessage(message).catch((error) => {
      debugLog('Unhandled message error', {
        event: message?.event,
        message: toErrorMessage(error),
      });
      logMessage(`Plugin message error: ${toErrorMessage(error)}`);
    });
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
}

async function handleMessage(message: any) {
  const { event, action, context, payload } = message;

  switch (event) {
    case 'keyDown':
      if (action === executeActionUUID) {
        debugLog('keyDown event received', {
          context: context.substring(0, 8),
          hasPayloadSettings: !!payload?.settings,
          payloadSettingsKeys: payload?.settings ? Object.keys(payload.settings) : [],
          hasCachedSettings: settingsCache.has(context),
          cachedSettingsKeys: settingsCache.has(context) ? Object.keys(settingsCache.get(context) || {}) : []
        });

        // Update cache with latest settings if available
        if (payload?.settings && Object.keys(payload.settings).length > 0) {
          settingsCache.set(context, payload.settings);
          debugLog('Updated cache from payload', { settingsKeys: Object.keys(payload.settings) });
        }

        // Use cached settings first, fallback to payload
        const settings = settingsCache.get(context) || payload?.settings || {};

        debugLog('Settings to use for execution', {
          source: settingsCache.has(context) ? 'cache' : 'payload',
          actionType: settings.actionType,
          hasRequiredFields: !!settings.actionType
        });

        handleExecuteAction(context, settings);
      }
      break;

    case 'didReceiveSettings':
      debugLog('didReceiveSettings event', { context, settings: payload?.settings });
      if (payload?.settings) {
        settingsCache.set(context, payload.settings);
        logMessage(`Settings received and cached for context: ${context.substring(0, 8)}...`);
      }
      break;

    case 'willAppear':
      debugLog('willAppear event', { context, settings: payload?.settings });
      if (payload?.settings) {
        settingsCache.set(context, payload.settings);
        logMessage(`Action appeared with settings for context: ${context.substring(0, 8)}...`);
      }
      setState(context, ActionState.Idle);
      break;

    case 'sendToPlugin':
      debugLog('sendToPlugin event received', { context, payload });
      if (payload && typeof payload === 'object') {
        await handlePropertyInspectorMessage(context, payload);
      }
      break;

    case 'willDisappear':
      // Cleanup
      settingsCache.delete(context);
      executionLock.delete(context);
      authSessionCache.delete(context);
      break;
  }
}

async function handlePropertyInspectorMessage(context: string, payload: any) {
  if (payload.type === 'getSecureSettings') {
    const settings = settingsCache.get(context) || {};
    const materialized = await secureSettingsStorage.materialize(settings);
    settingsCache.set(context, materialized);
    sendToPropertyInspector(context, {
      type: 'secureSettings',
      settings: materialized,
    });
    return;
  }

  const incomingSettings: Settings = payload.type === 'settingsChanged' ? payload.settings : payload;
  if (!incomingSettings || typeof incomingSettings !== 'object') {
    return;
  }

  const previousSettings = settingsCache.get(context) || {};
  const sanitizedSettings = await secureSettingsStorage.sanitizeForPersistence(
    context,
    incomingSettings,
    previousSettings
  );
  const materializedSettings = await secureSettingsStorage.materialize(sanitizedSettings);

  settingsCache.set(context, materializedSettings);
  sendEvent('setSettings', context, sanitizedSettings);
  logMessage(`Secure settings saved for context: ${context.substring(0, 8)}...`);
}

async function handleExecuteAction(context: string, settings: Settings) {
  debugLog('handleExecuteAction called', { context, settings });

  // Check if settings are empty or incomplete
  if (!settings.actionType || Object.keys(settings).length === 0) {
    logMessage('Settings not available, requesting from Stream Deck...');
    debugLog('Settings empty or incomplete, requesting getSettings');

    // Request settings and wait a bit
    sendEvent('getSettings', context);

    // Wait briefly for settings to arrive
    await new Promise(resolve => setTimeout(resolve, 200));

    // Try to get settings from cache again
    settings = settingsCache.get(context) || settings;

    if (!settings.actionType) {
      logMessage('Settings still not available. Please configure the action first.');
      setState(context, ActionState.Error);
      setTitle(context, 'Not Configured');
      showAlert(context);

      setTimeout(() => {
        setState(context, ActionState.Idle);
        setTitle(context, '');
      }, 2000);

      return;
    }
  }

  settings = await secureSettingsStorage.materialize(settings);
  settingsCache.set(context, settings);

  const validation = validateSettings(settings);
  if (!validation.valid) {
    const message = validation.errors[0] || 'Invalid action settings';
    logMessage(`Invalid settings: ${message}`);
    debugLog('Settings validation failed', validation);
    setState(context, ActionState.Error);
    setTitle(context, 'Invalid');
    showAlert(context);

    setTimeout(() => {
      setState(context, ActionState.Idle);
      setTitle(context, '');
    }, 2500);

    return;
  }

  validation.warnings.forEach(warning => logMessage(`Warning: ${warning}`));

  // Prevent concurrent executions
  if (executionLock.get(context)) {
    logMessage('Action already in progress, ignoring button press');
    debugLog('Action locked, returning');
    return;
  }

  executionLock.set(context, true);
  debugLog('Execution lock set, changing to Authenticating state');
  setState(context, ActionState.Authenticating);

  try {
    // Check if we need to authenticate
    const needsAuth = checkIfAuthenticationNeeded(context, settings);
    debugLog('Authentication needed?', needsAuth);

    if (needsAuth) {
      logMessage('Requesting Windows Hello authentication...');
      debugLog('About to call authenticateWithWindowsHello');
      const authResult = await authenticateWithWindowsHello();
      debugLog('Authentication result', authResult);

      if (!authResult.success) {
        logMessage('Authentication failed');
        setState(context, ActionState.Error);
        setTitle(context, 'Auth Failed!');
        showAlert(context);
        playSound('error');

        // Return to idle after 2 seconds
        setTimeout(() => {
          setState(context, ActionState.Idle);
          setTitle(context, '');
        }, 2000);

        return;
      }

      // Authentication successful - cache it
      authSessionCache.set(context, Date.now());
      logMessage('Authentication successful');
      debugLog('Auth successful, about to execute action');
    } else {
      logMessage('Using cached authentication session');
      debugLog('Using cached auth, about to execute action');
    }

    // Execute the configured action
    debugLog('Calling executeConfiguredAction', { actionType: settings.actionType });
    await executeConfiguredAction(context, settings);
    debugLog('executeConfiguredAction completed successfully');

    // Show success
    setState(context, ActionState.Success);
    setTitle(context, 'Success!');
    showOK(context);
    playSound('success');

    // Return to idle after 2 seconds
    setTimeout(() => {
      setState(context, ActionState.Idle);
      setTitle(context, '');
    }, 2000);

  } catch (error: any) {
    debugLog('ERROR in handleExecuteAction', {
      message: toErrorMessage(error),
      stack: error?.stack,
    });
    logMessage(`Error: ${toErrorMessage(error)}`);
    setState(context, ActionState.Error);
    setTitle(context, 'Error!');
    showAlert(context);
    playSound('error');

    // Return to idle after 3 seconds
    setTimeout(() => {
      setState(context, ActionState.Idle);
      setTitle(context, '');
    }, 3000);

  } finally {
    debugLog('Finally block - releasing execution lock');
    executionLock.set(context, false);
  }
}

function checkIfAuthenticationNeeded(context: string, settings: Settings): boolean {
  // Always require auth if configured
  if (settings.requireAuthEveryTime) {
    return true;
  }

  // Check session cache
  const lastAuthTime = authSessionCache.get(context);
  if (!lastAuthTime) {
    return true;
  }

  const sessionDuration = (settings.sessionDurationMinutes || 5) * 60 * 1000;
  const timeSinceAuth = Date.now() - lastAuthTime;

  return timeSinceAuth > sessionDuration;
}

async function authenticateWithWindowsHello(): Promise<{ success: boolean; message?: string }> {
  try {
    // Check if Windows Hello is available
    if (!windowsHelloAuth.isAvailable()) {
      return {
        success: false,
        message: 'Windows Hello is not available on this system'
      };
    }

    // Perform authentication
    const result: AuthResult = await windowsHelloAuth.authenticate('SecurePress - Authenticate to continue');

    if (result.success) {
      logMessage(`Windows Hello authentication successful (method: ${result.method})`);
      return { success: true };
    } else {
      logMessage(`Windows Hello authentication failed: ${result.error} - ${result.details}`);
      return {
        success: false,
        message: result.details || result.error || 'Authentication failed'
      };
    }

  } catch (error: any) {
    logMessage(`Windows Hello authentication error: ${error.message}`);
    return { success: false, message: error.message };
  }
}

async function executeConfiguredAction(context: string, settings: Settings) {
  const actionType = settings.actionType || 'program';
  debugLog('executeConfiguredAction switch', { actionType });

  switch (actionType) {
    case 'program':
      debugLog('Executing program action');
      await executeProgramAction(settings);
      break;
    case 'hotkey':
      debugLog('Executing hotkey action');
      await executeHotkeyAction(settings);
      break;
    case 'script':
      debugLog('Executing script action');
      await executeScriptAction(settings);
      break;
    case 'http':
      debugLog('Executing HTTP action');
      await executeHttpAction(settings);
      debugLog('HTTP action completed');
      break;
    case 'text':
      debugLog('Executing text action');
      await executeTextAction(settings);
      break;
    case 'sequence':
      debugLog('Executing sequence action');
      await executeSequenceAction(settings);
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

async function executeProgramAction(settings: Settings) {
  const programPath = settings.programPath;

  if (!programPath) {
    throw new Error('Program path is required');
  }

  const args = settings.programArgs || '';
  const workingDir = settings.workingDirectory || '';
  const parsedArgs = args ? parseArgumentString(args) : [];

  logMessage(`Executing program: ${programPath}`);
  debugLog('Program execution prepared', {
    programPath,
    argumentCount: parsedArgs.length,
    hasWorkingDirectory: !!workingDir,
  });

  try {
    const options: any = { timeout: 30000, windowsHide: true };
    if (workingDir) {
      options.cwd = workingDir;
    }

    const { stdout, stderr } = await execFileAsync(programPath, parsedArgs, options);

    if (stderr && !stdout) {
      logMessage(`Program stderr: ${stderr}`);
    }

    if (stdout) {
      logMessage(`Program output: ${stdout.toString().substring(0, 200)}`);
    }

    logMessage('Program executed successfully');
  } catch (error: any) {
    debugLog('Program execution error', getProcessErrorDetails(error));
    logMessage(`Program execution error: ${toErrorMessage(error)}`);
    throw new Error(`Failed to execute program: ${toErrorMessage(error)}`);
  }
}

async function executeHotkeyAction(settings: Settings) {
  const hotkeyKeys = settings.hotkeyKeys;

  if (!hotkeyKeys) {
    throw new Error('Hotkey keys are required');
  }

  logMessage(`Simulating hotkey: ${hotkeyKeys}`);

  try {
    const { modifiers, mainKey } = parseHotkeyKeys(hotkeyKeys);

    logMessage(`Parsed: modifiers=${modifiers.join(',')}, key=${mainKey}`);

    // Use Windows API directly via PowerShell for reliable key simulation
    const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySim {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const int KEYEVENTF_KEYDOWN = 0x0000;
    public const int KEYEVENTF_KEYUP = 0x0002;
}
"@

$VK_CONTROL = 0x11
$VK_SHIFT = 0x10
$VK_ALT = 0x12
$VK_LWIN = 0x5B

# Virtual key codes for common keys
$keyCodes = @{
    'A'=0x41; 'B'=0x42; 'C'=0x43; 'D'=0x44; 'E'=0x45; 'F'=0x46; 'G'=0x47; 'H'=0x48;
    'I'=0x49; 'J'=0x4A; 'K'=0x4B; 'L'=0x4C; 'M'=0x4D; 'N'=0x4E; 'O'=0x4F; 'P'=0x50;
    'Q'=0x51; 'R'=0x52; 'S'=0x53; 'T'=0x54; 'U'=0x55; 'V'=0x56; 'W'=0x57; 'X'=0x58;
    'Y'=0x59; 'Z'=0x5A;
    '0'=0x30; '1'=0x31; '2'=0x32; '3'=0x33; '4'=0x34;
    '5'=0x35; '6'=0x36; '7'=0x37; '8'=0x38; '9'=0x39;
    'F1'=0x70; 'F2'=0x71; 'F3'=0x72; 'F4'=0x73; 'F5'=0x74; 'F6'=0x75;
    'F7'=0x76; 'F8'=0x77; 'F9'=0x78; 'F10'=0x79; 'F11'=0x7A; 'F12'=0x7B;
    'F13'=0x7C; 'F14'=0x7D; 'F15'=0x7E; 'F16'=0x7F; 'F17'=0x80; 'F18'=0x81;
    'F19'=0x82; 'F20'=0x83; 'F21'=0x84; 'F22'=0x85; 'F23'=0x86; 'F24'=0x87;
    'TAB'=0x09; 'ENTER'=0x0D; 'ESC'=0x1B; 'SPACE'=0x20; 'BACKSPACE'=0x08;
    'DELETE'=0x2E; 'HOME'=0x24; 'END'=0x23; 'PAGEUP'=0x21; 'PAGEDOWN'=0x22;
    'UP'=0x26; 'DOWN'=0x28; 'LEFT'=0x25; 'RIGHT'=0x27;
}

Start-Sleep -Milliseconds 100

# Press modifiers
${modifiers.includes('CTRL') ? '[KeySim]::keybd_event($VK_CONTROL, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)' : ''}
${modifiers.includes('SHIFT') ? '[KeySim]::keybd_event($VK_SHIFT, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)' : ''}
${modifiers.includes('ALT') ? '[KeySim]::keybd_event($VK_ALT, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)' : ''}
${modifiers.includes('LWIN') ? '[KeySim]::keybd_event($VK_LWIN, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)' : ''}

# Press main key
$mainKeyCode = $keyCodes['${mainKey}']
if ($mainKeyCode) {
    [KeySim]::keybd_event($mainKeyCode, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [KeySim]::keybd_event($mainKeyCode, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
}

# Release modifiers
${modifiers.includes('LWIN') ? '[KeySim]::keybd_event($VK_LWIN, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)' : ''}
${modifiers.includes('ALT') ? '[KeySim]::keybd_event($VK_ALT, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)' : ''}
${modifiers.includes('SHIFT') ? '[KeySim]::keybd_event($VK_SHIFT, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)' : ''}
${modifiers.includes('CTRL') ? '[KeySim]::keybd_event($VK_CONTROL, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)' : ''}
    `.trim();

    await runPowerShellScript(psScript, 'streamdeck-hotkey', 5000);

    logMessage('Hotkey sent successfully via keybd_event');
  } catch (error: any) {
    debugLog('Hotkey execution error', getProcessErrorDetails(error));
    logMessage(`Hotkey execution error: ${toErrorMessage(error)}`);
    throw new Error(`Failed to send hotkey: ${toErrorMessage(error)}`);
  }
}

function convertToSendKeysFormat(hotkey: string): string {
  // SendKeys special characters:
  // ^ = Ctrl, % = Alt, + = Shift, ~ = Enter
  // For special keys use {KEY} format

  let result = hotkey;

  // Handle common patterns like "Ctrl+Alt+S"
  const parts = hotkey.split('+').map(p => p.trim().toLowerCase());

  let modifiers = '';
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        modifiers += '^';
        break;
      case 'alt':
        modifiers += '%';
        break;
      case 'shift':
        modifiers += '+';
        break;
      case 'win':
      case 'windows':
        key = '{LWIN}';
        break;
      case 'enter':
      case 'return':
        key = '~';
        break;
      case 'tab':
        key = '{TAB}';
        break;
      case 'esc':
      case 'escape':
        key = '{ESC}';
        break;
      case 'space':
        key = ' ';
        break;
      case 'backspace':
        key = '{BACKSPACE}';
        break;
      case 'delete':
      case 'del':
        key = '{DELETE}';
        break;
      case 'home':
        key = '{HOME}';
        break;
      case 'end':
        key = '{END}';
        break;
      case 'pageup':
      case 'pgup':
        key = '{PGUP}';
        break;
      case 'pagedown':
      case 'pgdn':
        key = '{PGDN}';
        break;
      case 'up':
        key = '{UP}';
        break;
      case 'down':
        key = '{DOWN}';
        break;
      case 'left':
        key = '{LEFT}';
        break;
      case 'right':
        key = '{RIGHT}';
        break;
      default:
        // F-keys
        if (part.match(/^f\d+$/)) {
          key = `{${part.toUpperCase()}}`;
        } else {
          // Regular character
          key = part;
        }
    }
  }

  return modifiers + key;
}

async function executeScriptAction(settings: Settings) {
  const scriptType = settings.scriptType || 'powershell';
  const scriptContent = settings.scriptContent;

  if (!scriptContent) {
    throw new Error('Script content is required');
  }

  logMessage(`Executing ${scriptType} script`);

  try {
    let temp: { dir: string; filePath: string } | undefined;
    let executable: string | undefined;
    let args: string[] | undefined;

    switch (scriptType) {
      case 'powershell':
        temp = createTempScript('securepress-script', 'ps1', scriptContent);
        executable = 'powershell.exe';
        args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', temp.filePath];
        break;

      case 'batch':
        temp = createTempScript('securepress-script', 'cmd', scriptContent);
        executable = 'cmd.exe';
        args = ['/d', '/c', temp.filePath];
        break;

      case 'python':
        temp = createTempScript('securepress-script', 'py', scriptContent);
        executable = 'python';
        args = [temp.filePath];
        break;

      default:
        throw new Error(`Unsupported script type: ${scriptType}`);
    }

    let stdout = '';
    let stderr = '';
    try {
      if (!executable || !args) {
        throw new Error(`Unsupported script type: ${scriptType}`);
      }
      const result = await execFileAsync(executable, args, { timeout: 30000, windowsHide: true });
      stdout = result.stdout;
      stderr = result.stderr;
    } finally {
      if (temp) {
        cleanupTempDir(temp.dir);
      }
    }

    if (stderr && !stdout) {
      logMessage(`Script stderr: ${stderr}`);
    }

    if (stdout) {
      logMessage(`Script output: ${stdout.toString().substring(0, 200)}`);
    }

    logMessage('Script executed successfully');
  } catch (error: any) {
    debugLog('Script execution error', getProcessErrorDetails(error));
    logMessage(`Script execution error: ${toErrorMessage(error)}`);
    throw new Error(`Failed to execute script: ${toErrorMessage(error)}`);
  }
}

async function executeTextAction(settings: Settings) {
  const textContent = settings.textContent;
  const textMode = settings.textMode || 'type';
  const pressEnter = settings.textPressEnter || false;

  if (!textContent) {
    throw new Error('Text content is required');
  }

  logMessage(`Typing text using mode: ${textMode}`);

  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-text-'));
    const textFile = path.join(tempDir, 'input.txt');
    fs.writeFileSync(textFile, textContent, 'utf8');

    let psScript = '';
    if (textMode === 'paste') {
      // Mode 1: Copy to clipboard and paste with Ctrl+V
      psScript = `
Add-Type -AssemblyName System.Windows.Forms
$text = [System.IO.File]::ReadAllText('${escapePowerShellSingleQuotedString(textFile)}')
[System.Windows.Forms.Clipboard]::SetText($text)
Start-Sleep -Milliseconds 100

# Simulate Ctrl+V
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class KeySim {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const int KEYEVENTF_KEYDOWN = 0x0000;
    public const int KEYEVENTF_KEYUP = 0x0002;
}
"@

$VK_CONTROL = 0x11
$VK_V = 0x56

# Press Ctrl+V
[KeySim]::keybd_event($VK_CONTROL, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)
[KeySim]::keybd_event($VK_V, 0, [KeySim]::KEYEVENTF_KEYDOWN, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 50
[KeySim]::keybd_event($VK_V, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
[KeySim]::keybd_event($VK_CONTROL, 0, [KeySim]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
      `.trim();

    } else {
      // Mode 2: Simulate typing character by character
      psScript = `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 100
$text = [System.IO.File]::ReadAllText('${escapePowerShellSingleQuotedString(textFile)}')
[System.Windows.Forms.SendKeys]::SendWait($text)
      `.trim();
    }

    // Add Enter key press if requested
    if (pressEnter) {
      psScript += `
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
      `;
    }

    try {
      const scriptPath = path.join(tempDir, 'input.ps1');
      fs.writeFileSync(scriptPath, psScript, 'utf8');
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 10000, windowsHide: true }
      );
      logMessage('Text input successful');
    } finally {
      cleanupTempDir(tempDir);
    }

  } catch (error: any) {
    debugLog('Text input error', getProcessErrorDetails(error));
    logMessage(`Text input error: ${toErrorMessage(error)}`);
    throw new Error(`Failed to input text: ${toErrorMessage(error)}`);
  }
}

async function executeHttpAction(settings: Settings) {
  debugLog('executeHttpAction called', { settings });
  const url = settings.httpUrl;
  const method = settings.httpMethod || 'GET';
  const body = settings.httpBody;
  const headersStr = settings.httpHeaders;

  debugLog('executeHttpAction variables', {
    url,
    method,
    hasBody: !!body,
    hasHeaders: !!headersStr,
  });

  if (!url) {
    debugLog('URL is missing, throwing error');
    throw new Error('HTTP URL is required');
  }

  debugLog('About to log HTTP request message');
  logMessage(`Making HTTP ${method} request to ${url}`);
  debugLog('Logged HTTP request message, entering try block');

  try {
    // Parse headers if provided (JSON format)
    let headers: any = { 'Content-Type': 'application/json' };
    if (headersStr) {
      try {
        headers = { ...headers, ...JSON.parse(headersStr) };
      } catch (e) {
        logMessage('Warning: Failed to parse headers, using defaults');
      }
    }

    // Build fetch options
    const options: any = {
      method,
      headers
    };

    // Add body for POST/PUT/DELETE
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      options.body = body;
    }

    // Make the request
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, options);

    const responseText = await response.text();

    if (!response.ok) {
      logMessage(`HTTP request failed: ${response.status} ${response.statusText}`);
      debugLog('HTTP error response received', {
        status: response.status,
        statusText: response.statusText,
        responseLength: responseText.length,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logMessage(`HTTP request successful: ${response.status}`);
    if (responseText) {
      debugLog('HTTP response received', {
        status: response.status,
        responseLength: responseText.length,
      });
    }

    // Show response popup if enabled
    debugLog('httpShowResponse setting value:', settings.httpShowResponse);
    logMessage(`Show response popup setting: ${settings.httpShowResponse}`);
    if (settings.httpShowResponse) {
      logMessage('Attempting to show response popup...');
      await showResponsePopup(method, url, response.status, responseText);
      logMessage('Response popup command completed');
    } else {
      logMessage('Response popup is disabled in settings');
    }

  } catch (error: any) {
    debugLog('HTTP request error', getProcessErrorDetails(error));
    logMessage(`HTTP request error: ${toErrorMessage(error)}`);
    throw new Error(`Failed to make HTTP request: ${toErrorMessage(error)}`);
  }
}

async function showResponsePopup(method: string, url: string, status: number, responseText: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamdeck-http-response-'));
  const messageFile = path.join(tempDir, 'message.txt');
  const scriptFile = path.join(tempDir, 'popup.ps1');

  try {
    logMessage('showResponsePopup function called');
    debugLog('showResponsePopup params', { method, url, status, responseTextLength: responseText.length });

    // Limit response length to avoid huge popups
    const maxLength = 1000;
    const displayText = responseText.length > maxLength
      ? responseText.substring(0, maxLength) + '\n\n... (truncated)'
      : responseText;

    // Format the message
    const message = `HTTP ${method} Request

URL: ${url}
Status: ${status}

Response:
${displayText}`;

    fs.writeFileSync(messageFile, message, 'utf8');

    // Create PowerShell script that shows the popup
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$message = [System.IO.File]::ReadAllText('${escapePowerShellSingleQuotedString(messageFile)}')
[System.Windows.Forms.MessageBox]::Show($message, 'HTTP Response', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    `.trim();

    fs.writeFileSync(scriptFile, psScript, 'utf8');

    debugLog('Executing PowerShell command for popup');
    logMessage('Executing PowerShell MessageBox command...');

    try {
      const result = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptFile],
        { timeout: 5000, windowsHide: true }
      );
      debugLog('PowerShell command result', result);
      logMessage('PowerShell MessageBox command executed successfully');
    } finally {
      cleanupTempDir(tempDir);
    }
  } catch (error: any) {
    debugLog('showResponsePopup ERROR', getProcessErrorDetails(error));
    logMessage(`Failed to show response popup: ${toErrorMessage(error)}`);
    cleanupTempDir(tempDir);
    // Don't throw - popup is optional, don't fail the whole request
  }
}

async function executeSequenceAction(settings: Settings) {
  const sequenceActions = settings.sequenceActions;

  if (!sequenceActions || !Array.isArray(sequenceActions) || sequenceActions.length === 0) {
    throw new Error('Sequence actions array is required');
  }

  logMessage(`Executing sequence of ${sequenceActions.length} actions`);

  for (let i = 0; i < sequenceActions.length; i++) {
    const action = sequenceActions[i];
    logMessage(`Sequence [${i + 1}/${sequenceActions.length}]: ${action.type || 'unknown'}`);

    try {
      // Each action in sequence can be any of the supported types
      switch (action.type) {
        case 'program':
          await executeProgramAction(action);
          break;
        case 'hotkey':
          await executeHotkeyAction(action);
          break;
        case 'script':
          await executeScriptAction(action);
          break;
        case 'http':
          await executeHttpAction(action);
          break;
        case 'text':
          await executeTextAction(action);
          break;
        case 'delay':
          // Special action type: wait for specified milliseconds
          const delayMs = action.delayMs || 1000;
          logMessage(`Waiting ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          break;
        default:
          logMessage(`Warning: Unknown sequence action type: ${action.type}`);
      }
    } catch (error: any) {
      logMessage(`Sequence action ${i + 1} failed: ${error.message}`);
      throw new Error(`Sequence failed at step ${i + 1}: ${error.message}`);
    }
  }

  logMessage('Sequence completed successfully');
}

// Stream Deck communication functions
function setState(context: string, state: ActionState) {
  sendEvent('setState', context, { state });
}

function setTitle(context: string, title: string) {
  sendEvent('setTitle', context, { title });
}

function showOK(context: string) {
  sendEvent('showOk', context);
}

function showAlert(context: string) {
  sendEvent('showAlert', context);
}

function logMessage(message: string) {
  sendEvent('logMessage', undefined, { message });
  console.log(message);
}

function playSound(soundType: 'success' | 'error') {
  const soundCommand =
    soundType === 'success'
      ? '[System.Media.SystemSounds]::Asterisk.Play()'
      : '[System.Media.SystemSounds]::Exclamation.Play()';

  execFile('powershell.exe', ['-NoProfile', '-Command', soundCommand], { windowsHide: true }, (error) => {
    if (error) {
      logMessage(`Failed to play sound: ${error.message}`);
    }
  });
}

function sendEvent(event: string, context?: string, payload?: any) {
  const message: any = { event };
  if (context) message.context = context;
  if (payload) message.payload = payload;
  if (ws && ws.readyState === WebSocketLib.WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendToPropertyInspector(context: string, payload: any) {
  if (ws && ws.readyState === WebSocketLib.WebSocket.OPEN) {
    ws.send(JSON.stringify({
      event: 'sendToPropertyInspector',
      action: executeActionUUID,
      context,
      payload,
    }));
  }
}

// Parse command line arguments and start
export function startPluginFromArgs(argv: string[] = process.argv.slice(2)) {
  const params: { [key: string]: string } = {};

  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^-+/, '');
    const value = argv[i + 1];
    if (value) {
      params[key] = value;
    }
  }

  if (params.port && params.pluginUUID && params.registerEvent && params.info) {
    connectElgatoStreamDeckSocket(
      params.port,
      params.pluginUUID,
      params.registerEvent,
      params.info
    );
  } else {
    console.error('Missing required arguments:', params);
    process.exit(1);
  }
}

if (require.main === module) {
  startPluginFromArgs();
}
