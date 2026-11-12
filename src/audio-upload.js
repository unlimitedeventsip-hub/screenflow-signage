import * as tus from 'tus-js-client';

// Direct-to-Supabase upload. Large MP3s are transferred in 6 MiB chunks
// directly from Admin to Storage (never through the Cloudflare Worker).
const STANDARD_UPLOAD_LIMIT = 6 * 1024 * 1024;

function storageEndpoint(projectUrl) {
  const u = new URL(projectUrl);
  // Supabase recommends the direct Storage host for resumable uploads.
  // Preserve custom domains in a safe, supported fallback.
  const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(u.hostname);
  const origin = match ? 'https://' + match[1] + '.storage.supabase.co' : u.origin;
  return origin + '/storage/v1/upload/resumable';
}

function describeUploadError(error) {
  const text = String(error && (error.message || error) || 'Eroare necunoscută');
  if (/\b413\b|EntityTooLarge|exceeds.*limit|file size limit|maximum file size|too large/i.test(text)) {
    return new Error('Supabase a respins fișierul: limita de stocare a proiectului este prea mică. Planul Free permite maximum 50 MB/fișier. Pentru 200 MB ai nevoie de Pro și de limită globală setată la cel puțin 200 MB în Storage Settings.');
  }
  if (/\b401\b|\b403\b|unauthorized|invalid.*jwt|expired/i.test(text)) {
    return new Error('Sesiunea de administrator a expirat sau nu are drepturi de încărcare. Reautentifică-te și încearcă din nou.');
  }
  return new Error('Încărcarea MP3 a eșuat: ' + text);
}

export async function uploadScreenflowAudio({ supabase, projectUrl, publicKey, file, path, onProgress }) {
  if (typeof onProgress === 'function') onProgress(0);
  // Small files still use the existing, simpler path.
  if (file.size <= STANDARD_UPLOAD_LIMIT) {
    const { error } = await supabase.storage.from('ads').upload(path, file, {
      contentType: 'audio/mpeg', cacheControl: '3600', upsert: false
    });
    if (error) throw describeUploadError(error);
    if (typeof onProgress === 'function') onProgress(100);
    return;
  }

  const { data, error: authError } = await supabase.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (authError || !token) throw new Error('Autentificarea administratorului a expirat. Conectează-te din nou.');

  return new Promise(function (resolve, reject) {
    const upload = new tus.Upload(file, {
      endpoint: storageEndpoint(projectUrl),
      headers: {
        authorization: 'Bearer ' + token,
        apikey: publicKey
      },
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'ads',
        objectName: path,
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      },
      onError: function (error) { reject(describeUploadError(error)); },
      onProgress: function (sent, total) {
        if (typeof onProgress === 'function' && total > 0) {
          onProgress(Math.min(100, Math.round(sent * 100 / total)));
        }
      },
      onSuccess: function () {
        if (typeof onProgress === 'function') onProgress(100);
        resolve();
      }
    });

    // Supabase TUS can resume partial transfers after a temporary interruption.
    upload.findPreviousUploads().then(function (previous) {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(function (error) { reject(describeUploadError(error)); });
  });
}
