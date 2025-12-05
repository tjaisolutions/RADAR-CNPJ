
const express = require('express');
const https = require('https');
const cors = require('cors');
const path = require('path');
const url = require('url');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// === 1. Servir Arquivos Estáticos ===
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// === 2. Proxy Genérico (CNPJa) ===

// Rota específica para CNPJa/Infosimples (POST)
// O frontend envia { url: '...', method: 'POST', data: ... }
app.post('/infosimples-proxy', (clientReq, clientRes) => {
  const { url: targetUrlStr, method, headers: customHeaders, data } = clientReq.body;

  if (!targetUrlStr) {
    return clientRes.status(400).json({ error: 'URL alvo não fornecida' });
  }

  const targetUrl = url.parse(targetUrlStr);
  const postData = data ? JSON.stringify(data) : null;

  const options = {
    hostname: targetUrl.hostname,
    port: 443,
    path: targetUrl.path,
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CNPJRadar/BackendProxy',
      ...customHeaders // Mescla os headers enviados pelo frontend
    },
    rejectUnauthorized: false,
    timeout: 60000 // Aumentado para 60s
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let responseBody = '';
    proxyRes.on('data', (chunk) => { responseBody += chunk; });
    proxyRes.on('end', () => {
      // Repassa o status original da API (ex: 429, 200, 500)
      clientRes.status(proxyRes.statusCode).send(responseBody);
    });
  });

  proxyReq.on('error', (e) => {
    console.error(`[CNPJa Proxy Error] ${e.message}`);
    if (!clientRes.headersSent) {
       clientRes.status(502).json({ error: 'Falha no Proxy CNPJa', details: e.message });
    }
  });

  proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!clientRes.headersSent) {
        clientRes.status(504).json({ error: 'Timeout ao conectar na API externa (60s excedido)' });
      }
  });

  if (postData) {
    proxyReq.write(postData);
  }
  proxyReq.end();
});

// === 3. Fix para Erro de CSS/MIME Type ===
app.get('*.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.send('');
});

// === 4. Fallback para SPA (React) ===
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send("Erro fatal: index.html não encontrado. Rode 'npm run build' localmente.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend rodando na porta ${PORT}`);
});
