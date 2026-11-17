interface BackupEnv {
  PUBLIC_MEDIA: R2Bucket;
  PRIVATE_VAULT: R2Bucket;
  BACKUPS: R2Bucket;
  BACKUP_TRIGGER_TOKEN: string;
}

interface BucketBackupResult {
  bucket: string;
  objects: number;
  bytes: number;
  copied: number;
  skipped: number;
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function backupBucket(
  source: R2Bucket,
  destination: R2Bucket,
  sourceName: string,
  snapshotPrefix: string,
): Promise<BucketBackupResult> {
  let cursor: string | undefined;
  let objects = 0;
  let bytes = 0;
  let copied = 0;
  let skipped = 0;

  do {
    const page = await source.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
    for (let index = 0; index < page.objects.length; index += 8) {
      const batch = page.objects.slice(index, index + 8);
      const results = await Promise.all(batch.map(async (listedObject) => {
        const destinationKey = snapshotPrefix + '/' + listedObject.key;
        const existing = await destination.head(destinationKey);
        if (existing?.customMetadata?.sourceEtag === listedObject.etag &&
            existing.size === listedObject.size) {
          return { copied: false, bytes: listedObject.size };
        }

        const sourceObject = await source.get(listedObject.key);
        if (!sourceObject) {
          throw new Error('Source object disappeared during backup: ' + sourceName + '/' + listedObject.key);
        }

        await destination.put(destinationKey, sourceObject.body, {
          httpMetadata: sourceObject.httpMetadata,
          customMetadata: {
            ...(sourceObject.customMetadata || {}),
            sourceBucket: sourceName,
            sourceEtag: listedObject.etag,
            sourceUploadedAt: listedObject.uploaded.toISOString(),
          },
        });

        const verification = await destination.head(destinationKey);
        if (!verification || verification.size !== listedObject.size ||
            verification.customMetadata?.sourceEtag !== listedObject.etag) {
          throw new Error('Backup verification failed for ' + sourceName + '/' + listedObject.key);
        }
        return { copied: true, bytes: listedObject.size };
      }));

      for (const result of results) {
        objects += 1;
        bytes += result.bytes;
        if (result.copied) copied += 1;
        else skipped += 1;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return { bucket: sourceName, objects, bytes, copied, skipped };
}

async function runBackup(env: BackupEnv) {
  const now = new Date();
  const snapshot = now.toISOString().replace(/[:.]/g, '-');
  const prefix = 'r2/production/' + snapshot;
  const [publicMedia, privateVault] = await Promise.all([
    backupBucket(env.PUBLIC_MEDIA, env.BACKUPS, 'pawshopes-public-media-production', prefix + '/public-media'),
    backupBucket(env.PRIVATE_VAULT, env.BACKUPS, 'pawshopes-private-vault-production', prefix + '/private-vault'),
  ]);

  const manifest = {
    createdAt: now.toISOString(),
    snapshotPrefix: prefix,
    source: 'Cloudflare R2 production buckets',
    results: [publicMedia, privateVault],
    verified: true,
  };
  const manifestKey = prefix + '/manifest.json';
  await env.BACKUPS.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
  });

  const verifiedManifest = await env.BACKUPS.head(manifestKey);
  if (!verifiedManifest) throw new Error('R2 backup manifest verification failed');

  return { success: true, ...manifest, manifestKey };
}

export default {
  async fetch(request: Request, env: BackupEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ success: true, service: 'Paws Hopes Society R2 backup worker' });
    }
    if (url.pathname !== '/run' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    const expected = env.BACKUP_TRIGGER_TOKEN || '';
    const supplied = request.headers.get('Authorization') || '';
    if (!expected || !constantTimeEqual(supplied, 'Bearer ' + expected)) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      return Response.json(await runBackup(env));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown R2 backup failure';
      return Response.json({ success: false, error: message }, { status: 500 });
    }
  },

  async scheduled(_event: ScheduledController, env: BackupEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runBackup(env));
  },
};
