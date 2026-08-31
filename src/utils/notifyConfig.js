/**
 * FairShare — Notification Config
 *
 * After deploying the Cloudflare Worker:
 * 1. Paste your Worker URL below (e.g. https://fairshare-notify.YOUR_NAME.workers.dev)
 * 2. Set the same NOTIFY_SECRET you used in Cloudflare dashboard → Worker → Variables
 */

// Paste your Cloudflare Worker URL here after deployment:
export const CLOUDFLARE_WORKER_URL = 'https://split-app.santhoshmuthu0311.workers.dev/';

// This must match the NOTIFY_SECRET environment variable in your Cloudflare Worker:
export const NOTIFY_SECRET = 'fairshare2024';
