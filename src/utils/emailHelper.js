import { Capacitor, registerPlugin } from '@capacitor/core';

// Register native plugin for Android
const NativeEmail = registerPlugin('NativeEmail');

/**
 * Open Gmail (or default email client) with pre-filled To, Subject, and Body.
 * On Android Capacitor APK: Directly launches the Gmail app via Android Intent with prefilled fields.
 * On Web/Desktop: Opens Google Mail compose URL or mailto.
 */
export const openEmailComposer = async ({ to, subject, body }) => {
  const recipient = (to || '').trim();
  const safeSubject = subject || '';
  const safeBody = body || '';

  // 1. Try Native Capacitor Plugin first on Android / iOS
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeEmail.openGmail({
        to: recipient,
        subject: safeSubject,
        body: safeBody
      });
      return true;
    } catch (err) {
      console.warn('NativeEmail plugin failed, trying browser fallbacks...', err);
    }
  }

  // 2. Web / Desktop / Mobile Browser Fallback
  const gmailWebComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;
  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(safeSubject)}&body=${encodeURIComponent(safeBody)}`;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Try opening mailto scheme
    try {
      window.location.href = mailtoUrl;
    } catch {
      window.open(gmailWebComposeUrl, '_blank');
    }
  } else {
    // Desktop: Open Gmail web compose in a new tab
    window.open(gmailWebComposeUrl, '_blank');
  }

  return true;
};
