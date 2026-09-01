# Automatic APK Versioning & Naming Rule

## Mandatory Protocol on EVERY Update / Code Change:
Whenever you update code, UI, features, assets, or fix bugs and generate an APK:

1. **Always Bump the Version**:
   - Increment `versionCode` (e.g. `4` -> `5`) and update `versionName` in `android/app/build.gradle`.
   - Update `CURRENT_APP_VERSION` in `src/utils/updateChecker.js` to match the exact same version string.
   - Update `version` in `package.json`.

2. **Always Name the Output APK with the Version**:
   - Format: `FairShare-v<version>.apk` (e.g., `FairShare-v1.3.0.apk`, `FairShare-v1.3.1.apk`).
   - Also update `FairShare.apk` and `FairShare-latest.apk` as convenience mirrors, but ensure the explicitly versioned file `FairShare-v<version>.apk` is ALWAYS generated.

3. **Build Command**:
   - Run `npm run build`
   - Run `npx cap sync android`
   - Run `gradlew assembleDebug` (signed with debug key for immediate installability)
   - Copy `android/app/build/outputs/apk/debug/app-debug.apk` to `FairShare-v<version>.apk`
