using System.Runtime.InteropServices;
using Windows.Security.Credentials.UI;

internal static class Program
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [STAThread]
    private static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--check")
        {
            return await CheckAvailability();
        }

        var message = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0])
            ? args[0]
            : "SecurePress - Authenticate to continue";

        var ownerWindow = GetForegroundWindow();

        try
        {
            var availability = await UserConsentVerifier.CheckAvailabilityAsync();
            if (availability != UserConsentVerifierAvailability.Available)
            {
                Console.WriteLine($"ERROR:NotAvailable:{availability}");
                return 1;
            }

            var result = IsWindow(ownerWindow)
                ? await UserConsentVerifierInterop.RequestVerificationForWindowAsync(ownerWindow, message)
                : await UserConsentVerifier.RequestVerificationAsync(message);

            if (IsWindow(ownerWindow))
            {
                SetForegroundWindow(ownerWindow);
            }

            return WriteResult(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR:Exception:{ex.Message}");
            return 99;
        }
    }

    private static async Task<int> CheckAvailability()
    {
        try
        {
            var availability = await UserConsentVerifier.CheckAvailabilityAsync();
            Console.WriteLine($"AVAILABLE:{availability}");
            return availability == UserConsentVerifierAvailability.Available ? 0 : 1;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR:Exception:{ex.Message}");
            return 99;
        }
    }

    private static int WriteResult(UserConsentVerificationResult result)
    {
        switch (result)
        {
            case UserConsentVerificationResult.Verified:
                Console.WriteLine("SUCCESS:Verified");
                return 0;
            case UserConsentVerificationResult.Canceled:
                Console.WriteLine("ERROR:Canceled");
                return 2;
            case UserConsentVerificationResult.DeviceBusy:
                Console.WriteLine("ERROR:DeviceBusy");
                return 3;
            case UserConsentVerificationResult.DeviceNotPresent:
                Console.WriteLine("ERROR:DeviceNotPresent");
                return 4;
            case UserConsentVerificationResult.DisabledByPolicy:
                Console.WriteLine("ERROR:DisabledByPolicy");
                return 5;
            case UserConsentVerificationResult.NotConfiguredForUser:
                Console.WriteLine("ERROR:NotConfiguredForUser");
                return 6;
            case UserConsentVerificationResult.RetriesExhausted:
                Console.WriteLine("ERROR:RetriesExhausted");
                return 7;
            default:
                Console.WriteLine($"ERROR:Unknown:{result}");
                return 8;
        }
    }
}
