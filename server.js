require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Configura timeout do servidor para lidar com scraping lento (2 minutos)
app.timeout = 120000;

// Chave API do Google (Fallback no código para teste, idealmente usar ENV)
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Rota de Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        google_key_configured: !!GOOGLE_API_KEY,
        msg: "Sistema de Streaming Ativo (Real-time)"
    });
});

// --- FUNÇÕES DE MINERAÇÃO E ENRIQUECIMENTO ---

const cleanString = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 1. MINERADOR WEB
 * Tenta encontrar o CNPJ fazendo scraping em sites de consulta pública.
 */
async function findCnpjInWeb(companyName, city) {
    try {
        // Delay aleatório reduzido para streaming ser mais fluido
        await wait(200 + Math.random() * 500);

        const termoBusca = `${cleanString(companyName)}-${cleanString(city)}`.replace(/ /g, "-");
        const searchUrl = `https://cnpj.biz/procura/${termoBusca}`;
        
        console.log(`[MINER] Buscando: ${companyName}...`);

        const response = await axios.get(searchUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000 // 5s timeout por request
        });

        const $ = cheerio.load(response.data);
        const textContent = $('body').text();
        
        // Regex para capturar CNPJ
        const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
        const matches = textContent.match(cnpjRegex);

        if (matches && matches.length > 0) {
            const cnpj = matches[0].replace(/[^\d]/g, '');
            return cnpj;
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * 2. ENRIQUECIMENTO BRASILAPI
 */
async function enrichWithBrasilApi(cnpj) {
    if (!cnpj) return null;
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 5000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * 3. PROCESSO DE UM LEAD
 */
async function processLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    
    // Objeto Base
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
        // Tenta Minerar CNPJ
        const foundCnpj = await findCnpjInWeb(rawName, location);

        if (foundCnpj) {
            companyData.cnpj = foundCnpj;
            
            // Busca na BrasilAPI
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

// ROTA DE PROSPECÇÃO COM STREAMING
app.post('/api/prospect', async (req, res) => {
    // Aumenta timeout desta rota específica
    req.setTimeout(300000); // 5 minutos de socket aberto

    const { niche, location } = req.body;

    // Configura headers para Streaming de Texto
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    if (!niche || !location) {
        res.write(JSON.stringify({ error: "Parâmetros inválidos" }) + "\n");
        return res.end();
    }

    try {
        console.log(`[STREAM] Iniciando: ${niche} em ${location}`);

        // 1. Busca no Google Places
        const googleResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchText',
            {
                textQuery: `${niche} em ${location}`,
                pageSize: 10 // Voltamos para 10 pois com stream o timeout não é problema
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus'
                },
                timeout: 15000
            }
        );

        const places = googleResponse.data.places || [];
        
        if (places.length === 0) {
            res.write(JSON.stringify({ info: "Nenhum lead encontrado no Google." }) + "\n");
            return res.end();
        }

        // 2. Processa e envia UM POR UM (Streaming)
        for (const place of places) {
            const result = await processLead(place, niche, location);
            // Envia o JSON do lead seguido de quebra de linha
            res.write(JSON.stringify(result) + "\n");
            // Limpa o buffer se possível (flush não é garantido no express, mas write força envio em chunked)
        }

    } catch (error) {
        console.error("Erro no Stream:", error.message);
        res.write(JSON.stringify({ error: "Erro na conexão com Google API ou limite excedido." }) + "\n");
    }

    res.end();
});

// Serve o Frontend (React)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
