const express = require('express');
const https = require('https');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// O endereço que sabemos que resolve DNS, mesmo com certificado ruim
const TARGET_HOST = 'api.cnpjs.dev';

app.use(cors());
app.use(express.json());

// === 1. Servir Arquivos Estáticos ===
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// === 2. Rota de Proxy para API ===
app.use('/v2', (clientReq, clientRes) => {
  console.log(`[Proxy Request] ${clientReq.method} ${clientReq.url}`);

  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: `/v2${clientReq.url}`,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      'host': TARGET_HOST, // Força o Host correto
      'user-agent': 'Mozilla/5.0 (Compatible; CNPJ-Radar/1.0)',
      'accept': 'application/json'
    },
    // CRÍTICO: Isso ignora o erro de certificado SSL que deu no seu terminal
    rejectUnauthorized: false 
  };

  // Limpa headers conflitantes
  delete options.headers['host'];
  delete options.headers['referer'];
  delete options.headers['origin'];

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[Proxy Response] Status: ${proxyRes.statusCode}`);

    // Headers CORS para o Frontend
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    
    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error(`[Proxy Error] ${e.message}`);
    if (!clientRes.headersSent) {
      clientRes.status(502).json({ 
        error: 'Erro de conexão com API externa', 
        details: e.message,
        triedUrl: TARGET_HOST
      });
    }
  });

  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    if (!clientRes.headersSent) {
      clientRes.status(504).json({ error: 'Timeout na conexão' });
    }
  });

  clientReq.pipe(proxyReq, { end: true });
});

// === 3. Fix para Erro de CSS/MIME Type ===
// Se pedir um arquivo estático que não existe, retorna 404 vazio, não HTML
app.get(/\.(css|js|png|jpg|ico|map)$/, (req, res) => {
  res.status(404).end();
});

// === 4. Fallback para SPA (React) ===
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send("Erro fatal: index.html não encontrado.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`👉 Proxy apontando para: ${TARGET_HOST} (SSL Ignored)`);
});
