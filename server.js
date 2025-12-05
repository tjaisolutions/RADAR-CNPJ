const express = require('express');
const https = require('https');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const TARGET_HOST = 'webservice.cnpj.biz';

// Habilita CORS para aceitar requisições do Frontend
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Frontend (React build)
// Isso permite que o Render sirva tanto o site quanto a API na mesma porta
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'build')));

// Rota de Proxy Genérica
// Captura qualquer requisição começando com /v2/... e repassa para a CNPJ.biz
app.use('/v2', (clientReq, clientRes) => {
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: `/v2${clientReq.url}`, // Mantém o caminho original (ex: /search?...)
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: TARGET_HOST // Engana a API para achar que o acesso é direto
    }
  };

  // Remove headers problemáticos que o navegador envia
  delete options.headers['host'];
  delete options.headers['referer'];
  delete options.headers['origin'];

  console.log(`[Proxy] Repassando para: https://${TARGET_HOST}/v2${clientReq.url}`);

  const proxyReq = https.request(options, (proxyRes) => {
    // Repassa o status e headers da API externa de volta para o Frontend
    clientRes.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'access-control-allow-origin': '*' // Garante CORS na volta
    });
    
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error(`[Proxy Error] ${e.message}`);
    clientRes.status(502).json({ error: 'Falha na conexão com API externa', details: e.message });
  });

  // Envia o corpo da requisição (se houver)
  clientReq.pipe(proxyReq, { end: true });
});

// Fallback para SPA (Single Page Application)
// Se não for API, entrega o index.html do React
app.get('*', (req, res) => {
  // Tenta encontrar o index.html na pasta build ou dist
  const fs = require('fs');
  if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else if (fs.existsSync(path.join(__dirname, 'build', 'index.html'))) {
     res.sendFile(path.join(__dirname, 'build', 'index.html'));
  } else {
     res.send('API Proxy is Running. Build the frontend to see the app.');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});