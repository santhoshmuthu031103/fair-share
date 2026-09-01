/**
 * updateChecker.js
 * Automatically checks GitHub Releases for new APK versions
 * and prompts the user to download and update.
 */

export const CURRENT_APP_VERSION = '1.0.0';
const GITHUB_REPO = 'santhoshmuthu031103/fair-share';
const GITHUB_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Compare two semver version strings like '1.0.1' and '1.0.0'
 * Returns true if newVer is strictly greater than currentVer
 */
export const isNewerVersion = (newVer, currentVer) => {
  if (!newVer || !currentVer) return false;

  // Clean strings (remove leading 'v' or 'V' and whitespace)
  const cleanNew = String(newVer).replace(/^v/i, '').trim();
  const cleanCur = String(currentVer).replace(/^v/i, '').trim();

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
 * Checks GitHub Releases API for the latest version
 */
export const checkForAppUpdate = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(GITHUB_LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { hasUpdate: false, error: `GitHub response status: ${res.status}` };
    }

    const data = await res.json();
    const releaseTag = data.tag_name || '';
    const latestVersion = releaseTag.replace(/^v/i, '');

    // Look for attached .apk asset in release
    let downloadUrl = data.html_url; // fallback to release page
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find(a => a.name && a.name.toLowerCase().endsWith('.apk'));
      if (apkAsset && apkAsset.browser_download_url) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    const hasUpdate = isNewerVersion(latestVersion, CURRENT_APP_VERSION);

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      releaseTag,
      releaseName: data.name || `Version ${latestVersion}`,
      releaseNotes: data.body || 'Performance improvements and bug fixes.',
      downloadUrl,
      publishedAt: data.published_at,
    };
  } catch (err) {
    console.warn('Update check error (safe to ignore if offline):', err);
    return { hasUpdate: false, error: err.message };
  }
};
