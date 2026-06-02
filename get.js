import fs from 'fs';
import readline from 'readline';
import { google } from 'googleapis';

const credentials = JSON.parse(
    fs.readFileSync('./oauth.json', 'utf8')
);

const { client_id, client_secret, redirect_uris } = credentials.web;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive'],
    prompt: 'consent',
});

console.log('Buka URL ini di browser:\n', authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('\nPaste code dari browser di sini: ', async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nTOKENS:\n', tokens);
    rl.close();
});
