import cors from 'cors';
import express from 'express';
import { google } from 'googleapis';

const PORT = process.env.PORT || 5000;
const app = express();

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
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

  try {
    const copy = await drive.files.copy({ fileId });

    if (copy.status !== 200 || !copy.data.id) {
      console.error(copy);
      renderFailure();
      return;
    }

    const id = copy.data.id;

    const perm = await drive.permissions.create({
      fileId: id,
      requestBody: {
        role: 'writer',
        type: 'anyone',
      },
    });

    if (perm.status !== 200) {
      console.error(perm);
      renderFailure();
      return;
    }

    res.redirect(`https://docs.google.com/document/d/${id}/edit`);
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
