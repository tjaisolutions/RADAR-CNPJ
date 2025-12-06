require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

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
        msg: "Sistema de Mineração Automática Pronto"
    });
});

// --- FUNÇÕES DE MINERAÇÃO E ENRIQUECIMENTO ---

const cleanString = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
};

/**
 * 1. MINERADOR WEB
 * Tenta encontrar o CNPJ fazendo scraping em sites de consulta pública.
 */
async function findCnpjInWeb(companyName, city) {
    try {
        // Tenta buscar no CNPJ.biz que tem url amigável: cnpj.biz/procura/nome-da-empresa-cidade
        const termoBusca = `${cleanString(companyName)}-${cleanString(city)}`.replace(/ /g, "-");
        const searchUrl = `https://cnpj.biz/procura/${termoBusca}`;
        
        console.log(`[MINER] Buscando CNPJ em: ${searchUrl}`);

        const response = await axios.get(searchUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 5000 // 5s timeout
        });

        const $ = cheerio.load(response.data);
        const textContent = $('body').text();
        
        // Regex para capturar CNPJ padrão XX.XXX.XXX/0001-XX
        const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
        const matches = textContent.match(cnpjRegex);

        if (matches && matches.length > 0) {
            // Retorna apenas números do primeiro CNPJ encontrado
            const cnpj = matches[0].replace(/[^\d]/g, '');
            console.log(`[MINER] CNPJ ENCONTRADO: ${cnpj} para ${companyName}`);
            return cnpj;
        }

        console.log(`[MINER] Nenhum CNPJ encontrado para ${companyName}`);
        return null;
    } catch (error) {
        console.log(`[MINER] Erro ao minerar ${companyName}: ${error.message}`);
        return null;
    }
}

/**
 * 2. ENRIQUECIMENTO BRASILAPI
 * Consulta dados oficiais na Receita Federal
 */
async function enrichWithBrasilApi(cnpj) {
    if (!cnpj) return null;
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 5000 });
        return response.data;
    } catch (error) {
        // 404 significa que CNPJ não existe ou API caiu
        return null;
    }
}

/**
 * 3. PROCESSO PRINCIPAL (PIPELINE)
 */
async function processLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    
    // Dados iniciais do Google
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
        score_enrichment: 30, // Score base (apenas Google)
        origin: 'google_places'
    };

    // Tenta Minerar CNPJ
    const foundCnpj = await findCnpjInWeb(rawName, location);

    if (foundCnpj) {
        companyData.cnpj = foundCnpj;
        
        // Se achou CNPJ, busca na BrasilAPI
        const fiscalData = await enrichWithBrasilApi(foundCnpj);

        if (fiscalData) {
            // Atualiza com dados oficiais
            companyData.razao_social = fiscalData.razao_social;
            companyData.nome_fantasia = fiscalData.nome_fantasia || rawName;
            companyData.data_abertura = fiscalData.data_inicio_atividade;
            companyData.status = fiscalData.descricao_situacao_cadastral;
            
            // Formata Capital Social
            try {
                 companyData.capital_social = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fiscalData.capital_social);
            } catch (e) { companyData.capital_social = fiscalData.capital_social; }

            companyData.porte = fiscalData.porte;
            companyData.contato.email = fiscalData.email || null;
            
            // Telefone Fiscal (muitas vezes melhor que o do Google)
            if (fiscalData.ddd_telefone_1) {
                const telFiscal = `(${fiscalData.ddd_telefone_1}) ${fiscalData.telefone_1}`;
                if (!companyData.contato.telefone) companyData.contato.telefone = telFiscal;
            }

            companyData.socios = (fiscalData.qsa || []).map(s => ({
                nome: s.nome_socio,
                qualificacao: s.qualificacao_socio
            }));

            // Endereço Fiscal
            companyData.endereco.bairro = fiscalData.bairro;
            companyData.endereco.cep = fiscalData.cep;
            companyData.endereco.logradouro = `${fiscalData.descricao_tipo_de_logradouro} ${fiscalData.logradouro}`;
            companyData.endereco.numero = fiscalData.numero;
            companyData.endereco.uf = fiscalData.uf;
            
            companyData.score_enrichment = 100;
        } else {
            companyData.score_enrichment = 60; // Tem CNPJ mas não BrasilAPI
        }
    }

    return companyData;
}

// ROTA DE PROSPECÇÃO AUTOMÁTICA
app.post('/api/prospect', async (req, res) => {
    const { niche, location } = req.body;

    if (!niche || !location) {
        return res.status(400).json({ error: "Parâmetros 'niche' e 'location' são obrigatórios." });
    }

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: "Chave API do Google não configurada no servidor." });
    }

    try {
        console.log(`[PROSPECT] Iniciando busca Google Places: ${niche} em ${location}`);

        // 1. Busca no Google Places
        const googleResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchText',
            {
                textQuery: `${niche} em ${location}`,
                pageSize: 10 // Limite de 10 para performance do scraping
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.businessStatus'
                }
            }
        );

        const places = googleResponse.data.places || [];
        
        if (places.length === 0) {
            return res.json({ message: "Nenhum lead encontrado nesta região.", data: [] });
        }

        console.log(`[PROSPECT] Encontrados ${places.length} leads. Iniciando enriquecimento...`);

        // 2. Processa cada lead (Scraping + BrasilAPI)
        // Promise.all permite que todos processem em paralelo
        const results = await Promise.all(
            places.map(place => processLead(place, niche, location))
        );

        res.json({
            message: "Prospecção Finalizada",
            data: results
        });

    } catch (error) {
        console.error("Erro Crítico no Servidor:", error.message);
        const msg = error.response?.data?.error?.message || error.message;
        res.status(500).json({ error: `Erro na prospecção: ${msg}` });
    }
});

// Serve o Frontend (React)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
