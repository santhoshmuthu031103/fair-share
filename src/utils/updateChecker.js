/**
 * updateChecker.js
 * Automatically checks for new FairShare APK versions via GitHub Releases
 */

import { App } from '@capacitor/app';

export const CURRENT_APP_VERSION = '1.5.5';
export const APP_DOWNLOAD_URL = 'https://github.com/santhoshmuthu031103/fair-share/releases/latest/download/FairShare-latest.apk';
export const APP_RELEASES_URL = 'https://github.com/santhoshmuthu031103/fair-share/releases/latest';
const GITHUB_REPO = 'santhoshmuthu031103/fair-share';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Returns the true installed version from native Android APK, or fallback to CURRENT_APP_VERSION
 */
export const getInstalledAppVersion = async () => {
  try {
    const info = await App.getInfo();
    if (info && info.version) {
      return info.version;
    }
  } catch (_) {
    // In browser/dev mode
  }
  return CURRENT_APP_VERSION;
};

/**
 * Compare two semver version strings like '1.2.0' and '1.1.0'
 * Returns true if newVer is strictly greater than currentVer
 */
export const isNewerVersion = (newVer, currentVer) => {
  if (!newVer || !currentVer) return false;

  const extract = (v) => {
    const match = String(v).match(/(\d+(?:\.\d+)*)/);
    return match ? match[1] : String(v).replace(/^v/i, '').trim();
  };

  const cleanNew = extract(newVer);
  const cleanCur = extract(currentVer);

  // If versions are identical, definitely no update
  if (cleanNew === cleanCur) return false;

  const newParts = cleanNew.split('.').map(p => parseInt(p, 10) || 0);
  const curParts = cleanCur.split('.').map(p => parseInt(p, 10) || 0);

  const maxLen = Math.max(newParts.length, curParts.length);
  for (let i = 0; i < maxLen; i++) {
    const n = newParts[i] || 0;
    const c = curParts[i] || 0;
    if (n > c) return true;
    if (n < c) return false;
  }
  return false;
};

/**
 * Checks GitHub Releases API for the latest published version
 */
export const checkForAppUpdate = async () => {
  try {
    const installedVersion = await getInstalledAppVersion();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeoutId);

    // If no release exists yet (404) or network error, return no update
    if (!res.ok) {
      return { hasUpdate: false, currentVersion: installedVersion };
    }

    const data = await res.json();
    const releaseTag = data.tag_name || '';
    const latestVersion = releaseTag.replace(/^v/i, '');

    // Check if published release is strictly newer than installed app version
    const hasUpdate = isNewerVersion(latestVersion, installedVersion);

    if (!hasUpdate) {
      return { hasUpdate: false, currentVersion: installedVersion, latestVersion };
    }

    // ALWAYS use the raw file URL from master branch — this serves the binary directly
    // without any GitHub web page, so Chrome downloads only ONE file, no release list shown
    const downloadUrl = 'https://github.com/santhoshmuthu031103/fair-share/raw/master/FairShare-latest.apk';

    return {
      hasUpdate: true,
      currentVersion: installedVersion,
      latestVersion,
      releaseTag,
      releaseName: data.name || `FairShare v${latestVersion}`,
      releaseNotes: data.body || 'Performance improvements and bug fixes.',
      downloadUrl,
    };
  } catch (err) {
    console.warn('Update check error (safe to ignore if offline):', err);
    return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
  }
};
