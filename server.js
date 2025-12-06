require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio'); // Biblioteca para ler HTML (Mining)

const app = express();
const PORT = process.env.PORT || 3000;

// Utiliza a variável de ambiente OU a chave fornecida diretamente como fallback
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Rota de verificação de status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        google_key_configured: !!GOOGLE_API_KEY
    });
});

// --- FUNÇÕES AUXILIARES DE MINERAÇÃO E ENRIQUECIMENTO ---

// Função para limpar strings para busca
const cleanString = (str) => {
    return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase() : "";
};

// 1. MINERADOR DE CNPJ (Tenta achar o CNPJ na web baseada no nome e cidade)
async function findCnpjInWeb(companyName, city) {
    try {
        // Estratégia: Buscar em um diretório público genérico. 
        // Nota: O Econodata bloqueia scrapers simples (Cloudflare). 
        // Usaremos uma busca simulada em diretórios mais abertos como 'cnpj.biz' ou busca geral.
        
        const query = `${cleanString(companyName)} ${cleanString(city)}`;
        const searchUrl = `https://cnpj.biz/procura/${query.replace(/ /g, "-")}`; 
        
        // Timeout curto para não travar o processo se o site demorar
        const response = await axios.get(searchUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 3000 
        });

        const $ = cheerio.load(response.data);
        
        // Tenta encontrar um padrão de CNPJ no HTML retornado
        // Padrão visual XX.XXX.XXX/0001-XX
        const textContent = $('body').text();
        const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
        const matches = textContent.match(cnpjRegex);

        if (matches && matches.length > 0) {
            // Retorna o primeiro CNPJ válido encontrado na página de busca
            return matches[0].replace(/[^\d]/g, '');
        }

        return null;
    } catch (error) {
        // Falha silenciosa na mineração é esperada (nem sempre acha)
        return null;
    }
}

// 2. ENRIQUECIMENTO (BrasilAPI)
async function enrichWithBrasilApi(cnpj) {
    if (!cnpj) return null;
    
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { timeout: 4000 });
        return response.data;
    } catch (error) {
        return null;
    }
}

// 3. PIPELINE DE PROCESSAMENTO INDIVIDUAL (Executa para cada Lead)
async function processLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    
    // Objeto base vindo do Google
    let companyData = {
        cnpj: null, // Ainda não temos
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
        score_enrichment: 30, // Score baixo inicial
        origin: 'google_places'
    };

    // ETAPA A: Tentar descobrir o CNPJ
    const foundCnpj = await findCnpjInWeb(rawName, location);

    if (foundCnpj) {
        companyData.cnpj = foundCnpj;
        
        // ETAPA B: Validar na BrasilAPI
        const fiscalData = await enrichWithBrasilApi(foundCnpj);

        if (fiscalData) {
            // MERGE: Juntar dados do Google com dados Fiscais
            companyData.razao_social = fiscalData.razao_social;
            companyData.nome_fantasia = fiscalData.nome_fantasia || rawName;
            companyData.data_abertura = fiscalData.data_inicio_atividade;
            companyData.status = fiscalData.descricao_situacao_cadastral;
            companyData.capital_social = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fiscalData.capital_social);
            companyData.porte = fiscalData.porte;
            companyData.contato.email = fiscalData.email || null; // Email fiscal é valioso
            
            // Se o Google não deu telefone, tenta o da Receita
            if (!companyData.contato.telefone && fiscalData.ddd_telefone_1) {
                companyData.contato.telefone = `(${fiscalData.ddd_telefone_1}) ${fiscalData.telefone_1}`;
            }

            companyData.socios = fiscalData.qsa.map(s => ({
                nome: s.nome_socio,
                qualificacao: s.qualificacao_socio
            }));

            companyData.endereco.bairro = fiscalData.bairro;
            companyData.endereco.cep = fiscalData.cep;
            companyData.endereco.logradouro = `${fiscalData.descricao_tipo_de_logradouro} ${fiscalData.logradouro}`;
            companyData.endereco.numero = fiscalData.numero;
            companyData.endereco.uf = fiscalData.uf;
            
            companyData.score_enrichment = 100; // Enriquecimento total
        } else {
            companyData.score_enrichment = 60; // Achamos CNPJ mas falhou BrasilAPI
        }
    }

    return companyData;
}


// --- ROTA PRINCIPAL ---

app.post('/api/prospect', async (req, res) => {
    const { niche, location } = req.body;

    if (!niche || !location) {
        return res.status(400).json({ error: "Nicho e Localização são obrigatórios." });
    }

    if (!GOOGLE_API_KEY) {
        return res.status(500).json({ error: "Configuração de API ausente no servidor." });
    }

    console.log(`[PROSPECT AUTO] Iniciando busca: ${niche} em ${location}`);

    try {
        // 1. Busca Google Places
        const googleResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchText',
            {
                textQuery: `${niche} em ${location}`,
                pageSize: 10 // LIMITADO A 10 para o processo de enriquecimento não demorar demais
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
            return res.json({ message: "Nenhum resultado encontrado no Google.", data: [] });
        }

        console.log(`[PROSPECT AUTO] Google retornou ${places.length} leads. Iniciando mineração de dados...`);

        // 2. Processamento Paralelo (Mineração + Enriquecimento)
        // Usamos Promise.all para processar todos os leads simultaneamente
        const enrichedResults = await Promise.all(
            places.map(place => processLead(place, niche, location))
        );

        console.log(`[SUCESSO] Processamento concluído.`);
        
        res.json({
            message: "Prospecção e Enriquecimento concluídos",
            data: enrichedResults
        });

    } catch (error) {
        console.error("Erro Geral:", error.message);
        const errorMsg = error.response?.data?.error?.message || "Falha no processo de prospecção automática.";
        res.status(500).json({ error: errorMsg });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
