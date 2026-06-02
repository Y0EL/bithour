import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
        scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
}

export function isFolderUrl(url: string) {
    return url.includes('/drive/folders/') || url.includes('id=') && !url.includes('/file/d/');
}

export async function getLatestVideoFromFolder(folderId: string) {
    const drive = await getDriveClient();
    const response = await drive.files.list({
        q: `'${folderId}' in parents and (mimeType contains 'video/' or mimeType = 'application/octet-stream') and trashed = false`,
        orderBy: 'createdTime desc',
        fields: 'files(id, name, mimeType, createdTime)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0];
    }
    return null;
}

export async function ensureCreatorFolder(creatorName: string, username: string, createdAt: Date) {
    const drive = await getDriveClient();
    const parentId = process.env.GOOGLE_DRIVE_PARENT_ID;

    // Format: username_YYYYMMDD
    const dateStr = createdAt.toISOString().split('T')[0].replace(/-/g, '');
    const folderName = `${username}_${dateStr}`;

    // Search for existing folder in parent
    const response = await drive.files.list({
        q: `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (response.data.files && response.data.files.length > 0) {
        const id = response.data.files[0].id;
        if (!id) throw new Error('Found folder but ID is missing');
        return id;
    }

    // Create new folder
    const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId!],
    };

    const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
        supportsAllDrives: true,
    });

    if (!folder.data.id) {
        throw new Error('Failed to create folder: ID is missing');
    }

    return folder.data.id;
}

export async function copyFileToDrive(sourceFileId: string, folderId: string, newFileName: string) {
    const drive = await getDriveClient();

    try {
        const response = await drive.files.copy({
            fileId: sourceFileId,
            requestBody: {
                name: newFileName,
                parents: [folderId],
            },
            supportsAllDrives: true,
        });
        return response.data.id;
    } catch (error) {
        console.error('Error copying file to Drive:', error);
        throw error;
    }
}

// Function to extract File ID from various Google Drive link formats
export function extractFileId(url: string) {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
}

/**
 * Generate a resumable upload URL for direct browser-to-Drive upload
 * This allows users to upload large files directly to Google Drive without going through our VPS
 */
export async function generateUploadUrl(
    fileName: string,
    mimeType: string,
    folderId: string,
    fileSize: number
) {
    // const drive = await getDriveClient(); // Not needed for fetch-based upload


    try {
        // Create metadata for the file
        const metadata = {
            name: fileName,
            parents: [folderId],
            mimeType: mimeType
        };

        // Request a resumable upload session
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${await getAccessToken()}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': mimeType,
                'X-Upload-Content-Length': fileSize.toString()
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google Drive Init Error Body:', errorBody);
            throw new Error(`Failed to initiate upload: ${response.statusText} - ${errorBody}`);
        }

        // Get the resumable upload URL from Location header
        const uploadUrl = response.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('No upload URL returned from Google Drive');
        }

        return uploadUrl;
    } catch (error) {
        console.error('Error generating upload URL:', error);
        throw error;
    }
}

/**
 * Get access token from Google Service Account
 */
async function getAccessToken() {
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
        scopes: SCOPES,
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token;
}

/**
 * Verify that a file was successfully uploaded to Drive
 */
export async function verifyUpload(fileId: string) {
    const drive = await getDriveClient();

    try {
        const response = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size, webViewLink, webContentLink',
            supportsAllDrives: true,
        });

        return response.data;
    } catch (error) {
        console.error('Error verifying upload:', error);
        throw error;
    }
}
/**
 * Stream a file from Google Drive
 */
export async function downloadFromDrive(fileId: string) {
    const drive = await getDriveClient();
    const response = await drive.files.get(
        { fileId: fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
    );
    return response;
}
