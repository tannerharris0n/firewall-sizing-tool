var express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const pdfRoute = require('./routes/pdf');
const rationaleRoute = require('./routes/rationale');

const app = express();
const PORT = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

if (isProduction) {
  app.use(
    cors({
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST']
    })
  );
} else {
  app.use(cors());
}

app.use('/api/pdf', pdfRoute);
app.use('/api/rationale', rationaleRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Firewall Sizing Tool listening on port ' + PORT);
});
