# Changelog

## 1.1.0 - 2026-06-08

- Added a self-contained Windows Hello helper so SecurePress does not require an external .NET runtime.
- Added DPAPI-backed secure settings storage for sensitive action fields.
- Added runtime and Property Inspector validation for required fields, HTTP headers, URLs, hotkeys, and sequence steps.
- Added automated tests for argument parsing, hotkey parsing, log redaction, validation, and DPAPI secure settings.
- Added GitHub Actions CI to test, build, package, upload artifacts, and attach tagged releases.
- Added tracked plugin manifest/versioning so generated plugin output is reproducible.
- Replaced generated placeholder icons with correctly sized transparent plugin/action/key assets.
- Cleaned packaged plugin assets so source images are not shipped inside the `.sdPlugin`.

## 1.0.0 - 2026-06-07

- Initial SecurePress Stream Deck plugin build.
