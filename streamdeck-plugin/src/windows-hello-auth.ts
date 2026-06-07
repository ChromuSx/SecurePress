import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface AuthResult {
  success: boolean;
  method?: 'helper' | 'native' | 'powershell';
  error?: string;
  details?: string;
}

export class WindowsHelloAuth {
  private passport: any = null;
  private useNative: boolean = false;
  private appId: string;

  constructor(appId: string = 'com.securepress.action') {
    this.appId = appId;
    this.initializeNativeAuth();
  }

  private initializeNativeAuth() {
    const { debugLog } = require('./debug-logger');

    try {
      debugLog('Attempting to load passport-desktop...');
      // Try to load passport-desktop
      const { Passport } = require('passport-desktop');

      debugLog('passport-desktop loaded, checking availability...');

      if (Passport.available()) {
        this.passport = new Passport(this.appId);
        this.useNative = true;
        debugLog('Windows Hello: Using native passport-desktop');
        console.log('Windows Hello: Using native passport-desktop');
      } else {
        debugLog('Windows Hello: Passport not available on this system');
        console.log('Windows Hello: Passport not available, will use PowerShell fallback');
      }
    } catch (error: any) {
      debugLog('Windows Hello: Failed to load passport-desktop', {
        message: error.message,
        stack: error.stack
      });
      console.log('Windows Hello: Failed to load passport-desktop, will use PowerShell fallback');
      console.log('Error:', error.message);
    }
  }

  /**
   * Check if Windows Hello is available on this system
   */
  public isAvailable(): boolean {
    if (this.isHelperAvailable()) {
      return true;
    }

    if (this.useNative && this.passport) {
      return true;
    }

    // Check PowerShell availability as fallback
    // Always return true on Windows, as PowerShell should be available
    return process.platform === 'win32';
  }

  /**
   * Authenticate user with Windows Hello
   * This will show the Windows Hello prompt (PIN, fingerprint, or face)
   */
  public async authenticate(message: string = 'Please authenticate'): Promise<AuthResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'NotAvailable',
        details: 'Windows Hello is not available on this system'
      };
    }

    // Prefer the helper because it attaches Windows Hello to the currently
    // active window, preventing the prompt from opening behind other windows.
    if (this.isHelperAvailable()) {
      const helperResult = await this.authenticateWithHelper(message);
      if (helperResult.success || helperResult.error !== 'HelperError') {
        return helperResult;
      }
    }

    // Try native method first
    if (this.useNative && this.passport) {
      return await this.authenticateNative();
    }

    // Fallback to PowerShell method
    return await this.authenticatePowerShell(message);
  }

  private getHelperPath(): string {
    return path.join(__dirname, '..', 'SecurePress.AuthHelper.exe');
  }

  private isHelperAvailable(): boolean {
    return process.platform === 'win32' && fs.existsSync(this.getHelperPath());
  }

  private async authenticateWithHelper(message: string): Promise<AuthResult> {
    const { debugLog } = require('./debug-logger');

    try {
      debugLog('Windows Hello: Using SecurePress.AuthHelper');
      const { stdout, stderr } = await execFileAsync(
        this.getHelperPath(),
        [message],
        { timeout: 60000, windowsHide: true }
      );

      debugLog('Auth helper execution complete', {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
      });

      return this.parseAuthOutput(stdout.toString().trim(), 'helper');
    } catch (error: any) {
      const output = error?.stdout?.toString().trim();
      if (output) {
        debugLog('Auth helper returned non-zero with output', { output });
        return this.parseAuthOutput(output, 'helper');
      }

      debugLog('Auth helper failed before returning a result', {
        message: error?.message,
        code: error?.code,
      });
      return {
        success: false,
        method: 'helper',
        error: 'HelperError',
        details: error?.message || 'Authentication helper failed'
      };
    }
  }

  /**
   * Authenticate using native passport-desktop package
   */
  private async authenticateNative(): Promise<AuthResult> {
    try {
      // Ensure account exists
      if (!this.passport.accountExists) {
        const KeyCreationOption = require('passport-desktop').KeyCreationOption;
        await this.passport.createAccount(KeyCreationOption.ReplaceExisting);
        console.log('Windows Hello: Created new account');
      }

      // Generate random challenge
      const crypto = require('crypto');
      const challenge = crypto.randomBytes(32);

      // This triggers Windows Hello prompt
      await this.passport.sign(challenge);

      return {
        success: true,
        method: 'native'
      };

    } catch (error: any) {
      // Parse error message for specific failures
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('cancel') || errorMsg.includes('user declined')) {
        return {
          success: false,
          method: 'native',
          error: 'Canceled',
          details: 'User canceled the authentication'
        };
      }

      if (errorMsg.includes('not configured') || errorMsg.includes('not enrolled')) {
        return {
          success: false,
          method: 'native',
          error: 'NotConfigured',
          details: 'Windows Hello is not configured for this user'
        };
      }

      if (errorMsg.includes('device busy')) {
        return {
          success: false,
          method: 'native',
          error: 'DeviceBusy',
          details: 'Biometric device is busy'
        };
      }

      return {
        success: false,
        method: 'native',
        error: 'Unknown',
        details: error.message
      };
    }
  }

  /**
   * Authenticate using PowerShell + Windows Runtime APIs
   */
  private async authenticatePowerShell(message: string): Promise<AuthResult> {
    const { debugLog } = require('./debug-logger');
    let tempDir = '';

    try {
      const psScript = this.generatePowerShellScript(message);
      debugLog('PowerShell script generated');

      // Write script to temp file
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'securepress-auth-'));
      const scriptPath = path.join(tempDir, 'auth.ps1');
      fs.writeFileSync(scriptPath, psScript, 'utf-8');
      debugLog('Script written to temp file', { scriptPath });

      // Execute PowerShell script from file
      const { stdout, stderr } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 60000, windowsHide: true }
      );

      // Clean up temp file
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }

      debugLog('PowerShell execution complete', {
        stdout: stdout.toString(),
        stderr: stderr.toString()
      });

      const output = stdout.toString().trim();
      return this.parseAuthOutput(output, 'powershell');

    } catch (error: any) {
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      return {
        success: false,
        method: 'powershell',
        error: 'PowerShellError',
        details: error.message
      };
    }
  }

  /**
   * Generate PowerShell script for Windows Hello authentication
   */
  private generatePowerShellScript(message: string): string {
    const escapedMessage = this.escapePowerShellSingleQuotedString(message);
    return `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime

      # Helper function to await async operations
      $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
          Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]

      function Await-AsyncOperation {
          param($WinRtTask, $ResultType)

          $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
          $netTask = $asTask.Invoke($null, @($WinRtTask))
          $netTask.Wait(-1) | Out-Null
          return $netTask.Result
      }

      # Load UserConsentVerifier
      [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime] | Out-Null

      # Check availability
      try {
          $availabilityOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()
          $availability = Await-AsyncOperation $availabilityOp ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])

          if ($availability -ne [Windows.Security.Credentials.UI.UserConsentVerifierAvailability]::Available) {
              Write-Output "ERROR:NotAvailable:$availability"
              exit 1
          }

          # Request verification
          $verifyOp = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync('${escapedMessage}')
          $result = Await-AsyncOperation $verifyOp ([Windows.Security.Credentials.UI.UserConsentVerificationResult])

          # Output result
          switch ($result) {
              ([Windows.Security.Credentials.UI.UserConsentVerificationResult]::Verified) {
                  Write-Output "SUCCESS:Verified"
                  exit 0
              }
              ([Windows.Security.Credentials.UI.UserConsentVerificationResult]::Canceled) {
                  Write-Output "ERROR:Canceled"
                  exit 2
              }
              ([Windows.Security.Credentials.UI.UserConsentVerificationResult]::DeviceNotPresent) {
                  Write-Output "ERROR:DeviceNotPresent"
                  exit 3
              }
              ([Windows.Security.Credentials.UI.UserConsentVerificationResult]::NotConfiguredForUser) {
                  Write-Output "ERROR:NotConfiguredForUser"
                  exit 4
              }
              ([Windows.Security.Credentials.UI.UserConsentVerificationResult]::DisabledByPolicy) {
                  Write-Output "ERROR:DisabledByPolicy"
                  exit 5
              }
              default {
                  Write-Output "ERROR:Unknown:$result"
                  exit 6
              }
          }
      } catch {
          Write-Output "ERROR:Exception:$($_.Exception.Message)"
          exit 99
      }
    `;
  }

  private parseAuthOutput(output: string, method: 'helper' | 'powershell'): AuthResult {
    if (output.includes('SUCCESS:Verified')) {
      return {
        success: true,
        method
      };
    }

    if (output.startsWith('ERROR:')) {
      const parts = output.split(':');
      const errorType = parts[1] || 'Unknown';

      return {
        success: false,
        method,
        error: errorType,
        details: this.getErrorMessage(errorType)
      };
    }

    throw new Error(`Unexpected authentication output: ${output}`);
  }

  private escapePowerShellSingleQuotedString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(errorType: string): string {
    const messages: { [key: string]: string } = {
      'Canceled': 'Authentication was canceled by the user',
      'NotAvailable': 'Windows Hello is not available on this system',
      'DeviceNotPresent': 'No biometric device found',
      'NotConfiguredForUser': 'Windows Hello is not set up for this user. Please configure it in Windows Settings',
      'DisabledByPolicy': 'Windows Hello is disabled by system policy',
      'DeviceBusy': 'The biometric device is currently busy',
      'RetriesExhausted': 'Too many authentication attempts failed. Please try again later',
      'Unknown': 'An unknown error occurred during authentication'
    };

    return messages[errorType] || messages['Unknown'];
  }

  /**
   * Clean up resources (optional)
   */
  public async cleanup(): Promise<void> {
    if (this.useNative && this.passport && this.passport.accountExists) {
      try {
        await this.passport.deleteAccount();
        console.log('Windows Hello: Account deleted');
      } catch (error) {
        console.log('Windows Hello: Failed to delete account:', error);
      }
    }
  }
}

// Export a simple function for quick authentication
export async function authenticateWithWindowsHello(
  message: string = 'Please authenticate',
  appId?: string
): Promise<AuthResult> {
  const auth = new WindowsHelloAuth(appId);
  return await auth.authenticate(message);
}
