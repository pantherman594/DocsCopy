import cors from 'cors';
import express from 'express';
import { google } from 'googleapis';
import path from 'path';

const PORT = process.env.PORT || 5000;
const app = express();

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../credentials.json'),
  scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({
  version: 'v3',
  auth,
});

const corsOptionsDelegate = (req: any, callback: any) => {
  const corsOptions = {
    origin: false,
    credentials: true,
  };

  const whitelist = [
    process.env.URL || 'http://localhost:3000',
  ];

  if (process.env.NODE_ENV !== 'production' || whitelist.indexOf(req.header('Origin')) !== -1) {
    corsOptions.origin = true; // reflect (enable) the requested origin in the CORS response
  }

  callback(null, corsOptions); // callback expects two parameters: error and options
};

app.use(cors(corsOptionsDelegate));

app.get('/:fileId', async (req, res) => {
  const { fileId } = req.params;

  const renderFailure = () => {
    res.sendStatus(500);
  }

  let originalName;

  try {
    const original = await drive.files.get({ fileId });

    if (!(original.data.mimeType || '').startsWith('application/vnd.google-apps.')) {
      res.send('This only works with Google Docs, Slides, and Sheets files.');
      return;
    }

    originalName = original.data.name;
  } catch (err) {
    if (err.response.status === 404) {
      res.send('This file cannot be copied (is it publicly available?).');
      return;
    }

    console.error(err);
    renderFailure();
    return;
  }

  try {
    const copy = await drive.files.copy({ fileId });

    if (!copy.data.id) {
      renderFailure();
      return;
    }

    const id = copy.data.id;

    const promises = [];

    promises.push(drive.files.update({ fileId: id, requestBody: { name: originalName } }));

    promises.push(drive.permissions.create({
      fileId: id,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    }));

    promises.push(drive.files.get({ fileId: id, fields: 'webViewLink' }));

    const [,, newFile] = await Promise.all(promises);

    res.redirect(newFile.data.webViewLink!);
  } catch (err) {
    console.error(err);
    renderFailure();
  }
});

app.use('/api/*', (req, res) => { // Handle 404
  res.status(404).write(`Cannot ${req.method} ${req.url}`);
});

app.listen(PORT, async () => {
  console.log(`Listening on port ${PORT}.`);
});
