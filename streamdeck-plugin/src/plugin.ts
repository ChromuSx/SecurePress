import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as WebSocketLib from 'ws';
import { WindowsHelloAuth, AuthResult } from './windows-hello-auth';
import { debugLog } from './debug-logger';

const execAsync = promisify(exec);
const windowsHelloAuth = new WindowsHelloAuth();

debugLog('Plugin modules loaded');

// Settings interface for action configuration
interface Settings {
  actionType?: 'program' | 'hotkey' | 'script' | 'http' | 'text' | 'sequence';

  // Program execution
  programPath?: string;
  programArgs?: string;
  workingDirectory?: string;

  // Hotkey simulation
  hotkeyKeys?: string;

  // Script execution
  scriptType?: 'powershell' | 'batch' | 'python';
  scriptContent?: string;

  // HTTP request
  httpUrl?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  httpBody?: string;
  httpHeaders?: string;
  httpShowResponse?: boolean;

  // Text input
  textContent?: string;
  textMode?: 'paste' | 'type';
  textPressEnter?: boolean;

  // Sequence
  sequenceActions?: Array<any>;

  // Authentication options
  requireAuthEveryTime?: boolean;
  sessionDurationMinutes?: number;
}

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
    handleMessage(message);
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });
}

function handleMessage(message: any) {
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
      // Property inspector sending settings directly
      debugLog('sendToPlugin event received', { context, payload });
      if (payload && typeof payload === 'object') {
        settingsCache.set(context, payload);
        logMessage(`Settings received directly from property inspector for context: ${context.substring(0, 8)}...`);
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
      message: error.message,
      stack: error.stack,
      error: error
    });
    logMessage(`Error: ${error.message}`);
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

  // Build command
  let command = `"${programPath}"`;
  if (args) {
    command += ` ${args}`;
  }

  logMessage(`Executing program: ${command}`);

  try {
    const options: any = { timeout: 30000 };
    if (workingDir) {
      options.cwd = workingDir;
    }

    const { stdout, stderr } = await execAsync(command, options);

    if (stderr && !stdout) {
      logMessage(`Program stderr: ${stderr}`);
    }

    if (stdout) {
      logMessage(`Program output: ${stdout.toString().substring(0, 200)}`);
    }

    logMessage('Program executed successfully');
  } catch (error: any) {
    logMessage(`Program execution error: ${error.message}`);
    throw new Error(`Failed to execute program: ${error.message}`);
  }
}

async function executeHotkeyAction(settings: Settings) {
  const hotkeyKeys = settings.hotkeyKeys;

  if (!hotkeyKeys) {
    throw new Error('Hotkey keys are required');
  }

  logMessage(`Simulating hotkey: ${hotkeyKeys}`);

  try {
    // Parse the hotkey to get modifiers and key
    const parts = hotkeyKeys.split('+').map(p => p.trim().toLowerCase());

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
        mainKey = part.toUpperCase();
      }
    }

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
    'TAB'=0x09; 'ENTER'=0x0D; 'ESC'=0x1B; 'SPACE'=0x20;
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

    // Save script to temp file to avoid escaping issues
    const fs = require('fs');
    const os = require('os');
    const tempFile = `${os.tmpdir()}\\streamdeck-hotkey-${Date.now()}.ps1`;

    fs.writeFileSync(tempFile, psScript, 'utf8');

    try {
      await execAsync(`powershell.exe -ExecutionPolicy Bypass -File "${tempFile}"`, {
        timeout: 5000
      });
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    logMessage('Hotkey sent successfully via keybd_event');
  } catch (error: any) {
    logMessage(`Hotkey execution error: ${error.message}`);
    throw new Error(`Failed to send hotkey: ${error.message}`);
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
    let command: string;

    switch (scriptType) {
      case 'powershell':
        // Execute PowerShell script inline
        command = `powershell.exe -ExecutionPolicy Bypass -Command "${scriptContent.replace(/"/g, '\\"')}"`;
        break;

      case 'batch':
        // Execute batch script inline
        command = `cmd.exe /c "${scriptContent.replace(/"/g, '\\"')}"`;
        break;

      case 'python':
        // Execute Python script inline
        command = `python -c "${scriptContent.replace(/"/g, '\\"')}"`;
        break;

      default:
        throw new Error(`Unsupported script type: ${scriptType}`);
    }

    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

    if (stderr && !stdout) {
      logMessage(`Script stderr: ${stderr}`);
    }

    if (stdout) {
      logMessage(`Script output: ${stdout.toString().substring(0, 200)}`);
    }

    logMessage('Script executed successfully');
  } catch (error: any) {
    logMessage(`Script execution error: ${error.message}`);
    throw new Error(`Failed to execute script: ${error.message}`);
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
    const fs = require('fs');
    const os = require('os');
    const tempFile = `${os.tmpdir()}\\streamdeck-text-${Date.now()}.ps1`;

    let psScript = '';

    if (textMode === 'paste') {
      // Mode 1: Copy to clipboard and paste with Ctrl+V
      const escapedText = textContent.replace(/'/g, "''");

      psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText(@'
${escapedText}
'@)
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
[System.Windows.Forms.SendKeys]::SendWait('${textContent.replace(/'/g, "''")}')
      `.trim();
    }

    // Add Enter key press if requested
    if (pressEnter) {
      psScript += `
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
      `;
    }

    // Save script to temp file
    fs.writeFileSync(tempFile, psScript, 'utf8');

    try {
      await execAsync(`powershell.exe -ExecutionPolicy Bypass -File "${tempFile}"`, {
        timeout: 10000
      });
      logMessage('Text input successful');
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

  } catch (error: any) {
    logMessage(`Text input error: ${error.message}`);
    throw new Error(`Failed to input text: ${error.message}`);
  }
}

async function executeHttpAction(settings: Settings) {
  debugLog('executeHttpAction called', { settings });
  const url = settings.httpUrl;
  const method = settings.httpMethod || 'GET';
  const body = settings.httpBody;
  const headersStr = settings.httpHeaders;

  debugLog('executeHttpAction variables', { url, method, body, headersStr });

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
      logMessage(`Response: ${responseText.substring(0, 200)}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logMessage(`HTTP request successful: ${response.status}`);
    if (responseText) {
      logMessage(`Response: ${responseText.substring(0, 200)}`);
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
    logMessage(`HTTP request error: ${error.message}`);
    throw new Error(`Failed to make HTTP request: ${error.message}`);
  }
}

async function showResponsePopup(method: string, url: string, status: number, responseText: string) {
  const fs = require('fs');
  const os = require('os');
  const tempFile = `${os.tmpdir()}\\streamdeck-http-response-${Date.now()}.ps1`;

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

    // Escape single quotes for PowerShell
    const escapedMessage = message.replace(/'/g, "''");

    // Create PowerShell script that shows the popup
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(@'
${escapedMessage}
'@, 'HTTP Response', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    `.trim();

    // Save script to temp file
    fs.writeFileSync(tempFile, psScript, 'utf8');

    debugLog('Executing PowerShell command for popup');
    logMessage('Executing PowerShell MessageBox command...');

    try {
      const result = await execAsync(`powershell.exe -ExecutionPolicy Bypass -File "${tempFile}"`, { timeout: 5000 });
      debugLog('PowerShell command result', result);
      logMessage('PowerShell MessageBox command executed successfully');
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error: any) {
    debugLog('showResponsePopup ERROR', { message: error.message, stack: error.stack });
    logMessage(`Failed to show response popup: ${error.message}`);
    // Clean up temp file on error too
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
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

  exec(`powershell -Command "${soundCommand}"`, (error) => {
    if (error) {
      logMessage(`Failed to play sound: ${error.message}`);
    }
  });
}

function sendEvent(event: string, context?: string, payload?: any) {
  const message: any = { event };
  if (context) message.context = context;
  if (payload) message.payload = payload;
  ws.send(JSON.stringify(message));
}

// Parse command line arguments and start
const args = process.argv.slice(2);
const params: { [key: string]: string } = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^-+/, '');
  const value = args[i + 1];
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
