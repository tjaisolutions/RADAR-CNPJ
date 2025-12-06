require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Chave API do Google
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- ARMAZENAMENTO DE JOBS EM MEMÓRIA ---
// Em produção real, usaria Redis ou Banco de Dados.
const jobs = {}; 

// Limpa jobs antigos a cada 10 minutos para não estourar memória
setInterval(() => {
    const now = Date.now();
    for (const id in jobs) {
        if (now - jobs[id].startTime > 10 * 60 * 1000) { // 10 min
            delete jobs[id];
        }
    }
}, 600000);

// --- FUNÇÕES UTILITÁRIAS ---

const cleanString = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * MINERADOR WEB
 */
async function findCnpjInWeb(companyName, city) {
    try {
        await wait(500 + Math.random() * 1000); // Delay humano

        const termoBusca = `${cleanString(companyName)}-${cleanString(city)}`.replace(/ /g, "-");
        const searchUrl = `https://cnpj.biz/procura/${termoBusca}`;
        
        console.log(`[MINER] Buscando CNPJ para: ${companyName}...`);

        const response = await axios.get(searchUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 8000
        });

        const $ = cheerio.load(response.data);
        const textContent = $('body').text();
        const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
        const matches = textContent.match(cnpjRegex);

        if (matches && matches.length > 0) {
            return matches[0].replace(/[^\d]/g, '');
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * ENRIQUECIMENTO BRASILAPI
 */
async function enrichWithBrasilApi(cnpj) {
    if (!cnpj) return null;
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 8000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * PROCESSAMENTO DE UM LEAD
 */
async function processLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    
    let companyData = {
        cnpj: null,
        razao_social: rawName,
        nome_fantasia: rawName,
        nicho: niche,
        status: place.businessStatus === 'OPERATIONAL' ? 'Ativa' : 'Inativa',
        data_abertura: "---",
        capital_social: "---",
        porte: "---",
        socios: [],
        endereco: {
            logradouro: place.formattedAddress || "",
            municipio: location,
            uf: "BR",
            cep: ""
        },
        contato: {
            email: null,
            telefone: place.nationalPhoneNumber || null,
            site: place.websiteUri || null
        },
        score_enrichment: 30, 
        origin: 'google_places'
    };

    try {
        const foundCnpj = await findCnpjInWeb(rawName, location);

        if (foundCnpj) {
            companyData.cnpj = foundCnpj;
            const fiscalData = await enrichWithBrasilApi(foundCnpj);

            if (fiscalData) {
                companyData.razao_social = fiscalData.razao_social;
                companyData.nome_fantasia = fiscalData.nome_fantasia || rawName;
                companyData.data_abertura = fiscalData.data_inicio_atividade;
                companyData.status = fiscalData.descricao_situacao_cadastral;
                try {
                    companyData.capital_social = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fiscalData.capital_social);
                } catch (e) { companyData.capital_social = fiscalData.capital_social; }
                companyData.porte = fiscalData.porte;
                companyData.contato.email = fiscalData.email || null;
                if (fiscalData.ddd_telefone_1) {
                    const telFiscal = `(${fiscalData.ddd_telefone_1}) ${fiscalData.telefone_1}`;
                    if (!companyData.contato.telefone) companyData.contato.telefone = telFiscal;
                }
                companyData.socios = (fiscalData.qsa || []).map(s => ({
                    nome: s.nome_socio,
                    qualificacao: s.qualificacao_socio
                }));
                companyData.endereco.bairro = fiscalData.bairro;
                companyData.endereco.cep = fiscalData.cep;
                companyData.endereco.logradouro = `${fiscalData.descricao_tipo_de_logradouro} ${fiscalData.logradouro}`;
                companyData.endereco.numero = fiscalData.numero;
                companyData.endereco.uf = fiscalData.uf;
                companyData.score_enrichment = 100;
            } else {
                companyData.score_enrichment = 60;
            }
        }
    } catch (e) {
        console.error(`Erro processando ${rawName}`, e.message);
    }

    return companyData;
}

// --- ROTAS DA API ---

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        mode: 'job_queue',
        google_key_configured: !!GOOGLE_API_KEY
    });
});

/**
 * PASSO 1: INICIAR O TRABALHO (Retorna rápido)
 */
app.post('/api/start-search', async (req, res) => {
    const { niche, location } = req.body;
    
    if (!niche || !location) {
        return res.status(400).json({ error: "Faltam parâmetros" });
    }

    const jobId = crypto.randomUUID();
    
    // Cria o Job na memória
    jobs[jobId] = {
        id: jobId,
        startTime: Date.now(),
        status: 'running',
        results: [],
        error: null
    };

    // Responde IMEDIATAMENTE para o frontend não dar timeout
    res.json({ jobId, message: "Busca iniciada em background" });

    // --- WORKER: Executa o processo pesado em background ---
    (async () => {
        try {
            console.log(`[JOB ${jobId}] Iniciando busca: ${niche} - ${location}`);
            
            // Busca no Google (Limitada para não demorar séculos no background)
            const googleResponse = await axios.post(
                'https://places.googleapis.com/v1/places:searchText',
                {
                    textQuery: `${niche} em ${location}`,
                    pageSize: 8 // Busca 8 por vez para ser ágil
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': GOOGLE_API_KEY,
                        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus'
                    },
                    timeout: 20000
                }
            );

            const places = googleResponse.data.places || [];

            if (places.length === 0) {
                 jobs[jobId].status = 'completed';
                 return;
            }

            // Processa um por um
            for (const place of places) {
                // Verifica se o job ainda existe (pode ter expirado)
                if (!jobs[jobId]) break;

                const result = await processLead(place, niche, location);
                
                // Adiciona ao array de resultados do Job
                if (jobs[jobId]) {
                    jobs[jobId].results.push(result);
                }
            }

            if (jobs[jobId]) {
                jobs[jobId].status = 'completed';
                console.log(`[JOB ${jobId}] Concluído com ${jobs[jobId].results.length} resultados.`);
            }

        } catch (error) {
            console.error(`[JOB ${jobId}] Erro Fatal:`, error.message);
            if (jobs[jobId]) {
                jobs[jobId].status = 'error';
                jobs[jobId].error = error.message;
            }
        }
    })();
});

/**
 * PASSO 2: CHECAR PROGRESSO (Polling)
 */
app.get('/api/check-search/:id', (req, res) => {
    const jobId = req.params.id;
    const job = jobs[jobId];

    if (!job) {
        return res.status(404).json({ error: "Job não encontrado ou expirado" });
    }

    res.json({
        id: job.id,
        status: job.status,
        results: job.results,
        error: job.error
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
