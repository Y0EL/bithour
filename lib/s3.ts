import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

// ===== DUAL STORAGE: supports MinIO (local), Tigris (Fly.io), R2, B2 =====

const getB2Endpoint = () => {
    const raw = process.env.B2_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
    if (!raw) return undefined;
    if (raw.startsWith('http')) return raw;
    return `https://${raw}`;
};

const getR2Endpoint = () => {
    const raw = process.env.R2_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3;
    if (!raw) return undefined;
    if (raw.startsWith('http')) return raw;
    return `https://${raw}`;
};

// Tigris (Fly.io) uses AWS_* env vars — fallback for both clients
const b2Client = new S3Client({
    endpoint: getB2Endpoint(),
    region: process.env.B2_REGION || process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.B2_APPLICATION_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

const r2Client = new S3Client({
    endpoint: getR2Endpoint(),
    region: process.env.R2_REGION || process.env.AWS_REGION || "auto",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

// Legacy alias — points to R2 for new uploads
const s3Client = r2Client;

/**
 * Detect which storage a URL belongs to
 */
function isR2Url(url: string): boolean {
    return url.includes('r2.cloudflarestorage.com') || url.includes(process.env.R2_BUCKET_NAME || '__r2__');
}

function isB2Url(url: string): boolean {
    return url.includes('backblazeb2.com') || url.includes(process.env.B2_ENDPOINT || '__b2__');
}

/**
 * Get the appropriate client and bucket for a given URL
 */
function getClientForUrl(url: string): { client: S3Client; bucket: string } {
    if (isR2Url(url)) {
        return { client: r2Client, bucket: process.env.R2_BUCKET_NAME! };
    }
    // Default to B2 for old data
    return { client: b2Client, bucket: process.env.B2_BUCKET_NAME! };
}

/**
 * Extract S3 key from a full URL (works for both B2 and R2)
 */
function extractS3Key(url: string): string {
    const bucketName = isR2Url(url)
        ? process.env.R2_BUCKET_NAME!
        : process.env.B2_BUCKET_NAME!;
    const urlParts = url.split(`${bucketName}/`);
    return decodeURIComponent(urlParts[urlParts.length - 1]);
}

// ===== UPLOAD FUNCTIONS (all go to R2) =====

export async function uploadToS3(fileBuffer: Buffer, fileName: string, contentType: string) {
    const bucketName = process.env.R2_BUCKET_NAME!;
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: fileBuffer,
            ContentType: contentType,
        });

        await r2Client.send(command);

        const endpoint = getR2Endpoint()?.replace('https://', '');
        const encodedFileName = fileName.split('/').map(part => encodeURIComponent(part)).join('/');
        return `https://${endpoint}/${bucketName}/${encodedFileName}`;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw error;
    }
}

/**
 * Upload file stream directly to R2 without saving to disk
 */
export async function uploadStreamToS3(
    stream: ReadableStream<Uint8Array> | Buffer | Uint8Array,
    fileName: string,
    contentType: string,
    contentLength?: number
) {
    const bucketName = process.env.R2_BUCKET_NAME!;
    try {
        const body =
            stream instanceof ReadableStream ? Readable.fromWeb(stream as any) : (stream as any);

        const uploader = new Upload({
            client: r2Client,
            params: {
                Bucket: bucketName,
                Key: fileName,
                Body: body,
                ContentType: contentType,
                ...(typeof contentLength === "number" ? { ContentLength: contentLength } : {}),
            },
            queueSize: 4,
            partSize: 10 * 1024 * 1024,
            leavePartsOnError: false,
        });

        await uploader.done();

        const endpoint = getR2Endpoint()?.replace('https://', '');
        const encodedFileName = fileName.split('/').map(part => encodeURIComponent(part)).join('/');
        return `https://${endpoint}/${bucketName}/${encodedFileName}`;
    } catch (error) {
        console.error("R2 Stream Upload Error:", error);
        throw error;
    }
}

// ===== DOWNLOAD FUNCTIONS (auto-detect B2 or R2) =====

/**
 * Download from the correct storage based on URL or key
 * If a full URL is provided, auto-detects B2 vs R2
 * If just a key is provided, tries R2 first, falls back to B2
 */
export async function downloadFromS3(fileName: string) {
    // If it's a full URL, detect the right client
    if (fileName.includes('://')) {
        const { client, bucket } = getClientForUrl(fileName);
        const key = extractS3Key(fileName);
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        return client.send(command);
    }

    // For plain keys, try the appropriate bucket
    // Check both R2 bucket and B2 bucket
    const r2Bucket = process.env.R2_BUCKET_NAME!;
    const b2Bucket = process.env.B2_BUCKET_NAME!;

    try {
        const command = new GetObjectCommand({ Bucket: r2Bucket, Key: fileName });
        return await r2Client.send(command);
    } catch {
        // Fallback to B2
        const command = new GetObjectCommand({ Bucket: b2Bucket, Key: fileName });
        return await b2Client.send(command);
    }
}

export async function getS3ObjectHead(fileName: string) {
    const r2Bucket = process.env.R2_BUCKET_NAME!;
    const b2Bucket = process.env.B2_BUCKET_NAME!;

    try {
        const command = new HeadObjectCommand({ Bucket: r2Bucket, Key: fileName });
        return await r2Client.send(command);
    } catch {
        const command = new HeadObjectCommand({ Bucket: b2Bucket, Key: fileName });
        return await b2Client.send(command);
    }
}

export async function downloadFromS3WithRange(fileName: string, range: string) {
    const r2Bucket = process.env.R2_BUCKET_NAME!;
    const b2Bucket = process.env.B2_BUCKET_NAME!;

    try {
        const command = new GetObjectCommand({ Bucket: r2Bucket, Key: fileName, Range: range });
        return await r2Client.send(command);
    } catch {
        const command = new GetObjectCommand({ Bucket: b2Bucket, Key: fileName, Range: range });
        return await b2Client.send(command);
    }
}

// ===== PRESIGNED URL FUNCTIONS =====

export async function generatePresignedUploadUrl(
    fileName: string,
    contentType: string,
    expiresIn: number = 3600
) {
    const bucketName = process.env.R2_BUCKET_NAME!;

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });

        const endpoint = getR2Endpoint()?.replace('https://', '');
        const encodedFileName = fileName.split('/').map(part => encodeURIComponent(part)).join('/');
        const finalUrl = `https://${endpoint}/${bucketName}/${encodedFileName}`;

        return { uploadUrl, finalUrl, fileName };
    } catch (error) {
        console.error("Error generating presigned upload URL:", error);
        throw error;
    }
}

/**
 * Generate presigned download URL — auto-detects B2 vs R2 based on the stored URL
 * For R2: uses R2 presigned URL (with CDN benefits)
 * For B2: uses B2 presigned URL (legacy data)
 */
export async function generatePresignedDownloadUrl(
    fileNameOrUrl: string,
    expiresIn: number = 7200
) {
    let client: S3Client;
    let bucket: string;
    let key: string;

    if (fileNameOrUrl.includes('://')) {
        // Full URL — detect storage
        const info = getClientForUrl(fileNameOrUrl);
        client = info.client;
        bucket = info.bucket;
        key = extractS3Key(fileNameOrUrl);
    } else {
        // Plain key — use R2 by default (for new data)
        client = r2Client;
        bucket = process.env.R2_BUCKET_NAME!;
        key = fileNameOrUrl;
    }

    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const downloadUrl = await getSignedUrl(client, command, { expiresIn });
        return downloadUrl;
    } catch (error) {
        console.error("Error generating presigned download URL:", error);
        throw error;
    }
}
