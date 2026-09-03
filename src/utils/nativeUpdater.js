import { registerPlugin } from '@capacitor/core';

export const NativeUpdate = registerPlugin('NativeUpdate');

/**
 * Downloads APK directly inside the app with real-time percentage progress,
 * then immediately launches Android's native installer prompt.
 * No browser or external redirects are used!
 */
export const downloadAndInstallUpdate = async (downloadUrl, onProgress) => {
  let progressSub = null;
  if (onProgress && typeof onProgress === 'function') {
    try {
      progressSub = await NativeUpdate.addListener('downloadProgress', (data) => {
        onProgress(data);
      });
    } catch (_) {}
  }

  try {
    const res = await NativeUpdate.downloadAndInstall({ url: downloadUrl });
    return res;
  } finally {
    if (progressSub && progressSub.remove) {
      try {
        progressSub.remove();
      } catch (_) {}
    }
  }
};

/**
 * Checks if the app has permission to install unknown apps (Android 8+)
 */
export const checkCanInstall = async () => {
  try {
    const res = await NativeUpdate.canRequestInstalls();
    return res?.canInstall ?? true;
  } catch (_) {
    return true;
  }
};

/**
 * Opens Android system settings for granting unknown app installs
 */
export const openInstallPermissionSettings = async () => {
  try {
    await NativeUpdate.openInstallSettings();
  } catch (_) {}
};

/**
 * Retrieves any notification payload that launched or woke the app
 */
export const getPendingNotification = async () => {
  try {
    const res = await NativeUpdate.getPendingNotification();
    return res?.notification || null;
  } catch (_) {
    return null;
  }
};

/**
 * Listens for real-time notification open events
 */
export const addNotificationListener = (callback) => {
  try {
    return NativeUpdate.addListener('notificationOpened', callback);
  } catch (_) {
    return { remove: () => {} };
  }
};
