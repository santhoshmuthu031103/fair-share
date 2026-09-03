import fs from 'fs';
import path from 'path';

let GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
if (!GITHUB_TOKEN && fs.existsSync('.github_token')) {
  GITHUB_TOKEN = fs.readFileSync('.github_token', 'utf8').trim();
}
const REPO = 'santhoshmuthu031103/fair-share';

async function publishRelease(version, releaseNotes) {
  const tag = `v${version.replace(/^v/, '')}`;
  console.log(`Creating GitHub Release for ${tag}...`);

  // 1. Check if release already exists
  const checkRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'FairShare-Releaser'
    }
  });

  let releaseData;
  if (checkRes.ok) {
    releaseData = await checkRes.json();
    console.log(`Release ${tag} already exists (ID: ${releaseData.id}), updating...`);
  } else {
    // Create new release
    const createRes = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'FairShare-Releaser'
      },
      body: JSON.stringify({
        tag_name: tag,
        target_commitish: 'master',
        name: `FairShare ${tag}`,
        body: releaseNotes || `FairShare ${tag} update with performance enhancements and bug fixes.`,
        draft: false,
        prerelease: false
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create release: ${errText}`);
    }
    releaseData = await createRes.json();
    console.log(`Created release ${tag} (ID: ${releaseData.id})`);
  }

  // 2. Upload APK assets if available
  const apkFiles = [
    { name: `FairShare-${tag}.apk`, filePath: path.resolve(`FairShare-${tag}.apk`) },
    { name: 'FairShare-latest.apk', filePath: path.resolve('FairShare-latest.apk') },
    { name: 'FairShare.apk', filePath: path.resolve('FairShare.apk') }
  ];

  for (const apk of apkFiles) {
    if (fs.existsSync(apk.filePath)) {
      console.log(`Uploading asset: ${apk.name}...`);
      const fileBuffer = fs.readFileSync(apk.filePath);

      // Check if asset already exists in release and delete it before re-uploading
      if (releaseData.assets && releaseData.assets.length > 0) {
        const existing = releaseData.assets.find(a => a.name === apk.name);
        if (existing) {
          console.log(`Deleting existing asset ${apk.name} (ID: ${existing.id})...`);
          await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${existing.id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${GITHUB_TOKEN}`,
              'User-Agent': 'FairShare-Releaser'
            }
          });
        }
      }

      const uploadUrl = `https://uploads.github.com/repos/${REPO}/releases/${releaseData.id}/assets?name=${encodeURIComponent(apk.name)}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/vnd.android.package-archive',
          'User-Agent': 'FairShare-Releaser'
        },
        body: fileBuffer
      });

      if (uploadRes.ok) {
        console.log(`✓ Uploaded ${apk.name} successfully!`);
      } else {
        console.warn(`Asset upload failed for ${apk.name}:`, await uploadRes.text());
      }
    }
  }

  console.log(`🎉 Release ${tag} published successfully! URL: ${releaseData.html_url}`);
}

const targetVersion = process.argv[2] || '1.5.5';
const notes = process.argv[3] || 'Instant 0ms chat loading from local cache, zero-scroll instant bottom positioning on open, and floating scroll-to-latest button.';

publishRelease(targetVersion, notes).catch(err => {
  console.error('Publish error:', err);
  process.exit(1);
});
