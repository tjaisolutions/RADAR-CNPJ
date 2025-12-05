const express = require('express');
const https = require('https');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const TARGET_HOST = 'webservice.cnpj.biz';

app.use(cors());
app.use(express.json());

// === 1. Servir Arquivos Estáticos com Cache ===
const staticOptions = {
  maxAge: '1d', // Cache por 1 dia
  fallthrough: false // Se não achar o arquivo, não passa para a próxima rota (vai pro catch 404)
};

// Tenta servir do 'dist' (produção) ou 'build'
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
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Simula navegador
      'accept': 'application/json'
    },
    // IMPORTANTE: Isso resolve erros de SSL em alguns ambientes de nuvem
    rejectUnauthorized: false 
  };

  // Limpa headers que entregam que é um proxy
  delete options.headers['host'];
  delete options.headers['referer'];
  delete options.headers['origin'];
  delete options.headers['x-forwarded-for'];

  const proxyReq = https.request(options, (proxyRes) => {
    // Log do status recebido da API
    console.log(`[Proxy Response] Status: ${proxyRes.statusCode}`);

    // Repassa headers
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*'; // Garante CORS
    
    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (e) => {
    console.error(`[Proxy Error] ${e.message}`);
    // Se o cliente já não recebeu resposta, envia 502
    if (!clientRes.headersSent) {
      clientRes.status(502).json({ 
        error: 'Erro de conexão com API externa', 
        details: e.message,
        tip: 'Verifique se a API está online ou bloqueando IPs de datacenter.'
      });
    }
  });

  // Timeout de 10 segundos para não travar a requisição
  proxyReq.setTimeout(10000, () => {
    console.error('[Proxy Timeout]');
    proxyReq.destroy();
    if (!clientRes.headersSent) {
      clientRes.status(504).json({ error: 'Timeout na conexão com API externa' });
    }
  });

  clientReq.pipe(proxyReq, { end: true });
});

// === 3. Tratamento de Erros de Arquivos Estáticos (CSS/JS) ===
// Se o navegador pedir um .css ou .js que não existe, retorna 404 em vez de HTML
app.get(/\.(css|js|png|jpg|ico)$/, (req, res) => {
  res.status(404).send('File not found');
});

// === 4. Fallback para SPA (React) ===
// Qualquer outra rota retorna o index.html para o React controlar
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send("Erro ao carregar aplicação: index.html não encontrado. Verifique o build.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`👉 Proxy apontando para: ${TARGET_HOST}`);
});
