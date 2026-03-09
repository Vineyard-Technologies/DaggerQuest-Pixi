import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = 'daggerquestassets';
const LOCAL_DIR = 'images/spritesheets';

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

function walk(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) results.push(...walk(full));
        else results.push(full);
    }
    return results;
}

function md5(filePath: string): string {
    return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

async function getRemoteETags(): Promise<Map<string, string>> {
    const etags = new Map<string, string>();
    let continuationToken: string | undefined;

    do {
        const res = await s3.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            ContinuationToken: continuationToken,
        }));
        for (const obj of res.Contents ?? []) {
            if (obj.Key && obj.ETag) {
                // ETags come quoted like '"abc123"', strip quotes
                etags.set(obj.Key, obj.ETag.replace(/"/g, ''));
            }
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return etags;
}

async function main() {
    const files = walk(LOCAL_DIR);
    console.log(`Found ${files.length} local files. Checking remote bucket...\n`);

    const remoteETags = await getRemoteETags();
    console.log(`Found ${remoteETags.size} existing objects in R2.\n`);

    const toUpload: string[] = [];
    for (const file of files) {
        const key = file.replace(/\\/g, '/');
        const localHash = md5(file);
        const remoteETag = remoteETags.get(key);
        if (remoteETag && remoteETag === localHash) continue;
        toUpload.push(file);
    }

    if (toUpload.length === 0) {
        console.log('All assets are up to date — nothing to upload.');
        return;
    }

    console.log(`Uploading ${toUpload.length} new/changed files...\n`);

    for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i]!;
        const key = file.replace(/\\/g, '/');
        console.log(`[${i + 1}/${toUpload.length}] ${key}`);
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: readFileSync(file),
        }));
    }

    console.log(`\nDone! Uploaded ${toUpload.length} files.`);
}

main();

