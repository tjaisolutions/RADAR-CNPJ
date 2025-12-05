const http = require('http');
const https = require('https');
const url = require('url');

// Configurações
const PORT = 4000;
const TARGET_HOST = 'webservice.cnpj.biz'; // A URL real da API

const server = http.createServer((clientReq, clientRes) => {
  const parsedUrl = url.parse(clientReq.url);

  // 1. Configurar Headers CORS (Permite tudo para evitar bloqueio do navegador)
  const headers = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
  };

  // 2. Responder imediatamente a requisições OPTIONS (Preflight)
  if (clientReq.method === 'OPTIONS') {
    clientRes.writeHead(204, headers);
    clientRes.end();
    return;
  }

  // 3. Configurar a requisição para a API Real
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: parsedUrl.path, // Mantém o caminho (ex: /v2/search?...)
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: TARGET_HOST // Importante: Engana a API para achar que o acesso é direto
    }
  };

  // 4. Fazer a requisição para a API externa
  const proxyReq = https.request(options, (proxyRes) => {
    // Copiar headers da resposta da API para o Cliente
    Object.keys(proxyRes.headers).forEach(key => {
      headers[key] = proxyRes.headers[key];
    });
    
    // Forçar CORS novamente na resposta para garantir
    headers['Access-Control-Allow-Origin'] = '*';

    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes, {
      end: true
    });
  });

  proxyReq.on('error', (e) => {
    console.error(`[Proxy Error] Falha ao conectar na API externa: ${e.message}`);
    clientRes.writeHead(502, { ...headers, 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Falha na conexão do Proxy com a API CNPJ.biz', details: e.message }));
  });

  // Enviar dados do cliente para o proxy (pipe)
  clientReq.pipe(proxyReq, {
    end: true
  });
});

server.listen(PORT, () => {
  console.log(`\n=======================================================`);
  console.log(`🚀 PROXY LOCAL RODANDO EM: http://localhost:${PORT}`);
  console.log(`📡 Redirecionando para: https://${TARGET_HOST}`);
  console.log(`📝 Para usar: Deixe este terminal aberto.`);
  console.log(`=======================================================\n`);
});