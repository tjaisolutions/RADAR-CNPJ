require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Proteção contra crash do servidor
process.on('uncaughtException', (err) => {
  console.error('[SERVER CRASH PREVENTED]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Chaves de API
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";
const CNPJA_API_KEY = process.env.CNPJA_API_KEY || "50cd7f37-a8a7-4076-b180-520a12dfdc3c-608f7b7f-2488-44b9-81f5-017cf47d154b";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- ARMAZENAMENTO DE JOBS EM MEMÓRIA ---
const jobs = {}; 

// Limpeza de Jobs antigos
setInterval(() => {
    const now = Date.now();
    for (const id in jobs) {
        if (now - jobs[id].startTime > 15 * 60 * 1000) { 
            delete jobs[id];
        }
    }
}, 600000);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tenta extrair a UF de uma string de localização
 */
function extractStateFromLocation(location) {
    if (!location) return null;
    const validUFs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SP","SE","TO"];
    
    // Tenta achar UF solta na string (ex: "São Paulo SP")
    const words = location.toUpperCase().split(/[\s,-]+/);
    const found = words.find(w => validUFs.includes(w));
    return found || null;
}

/**
 * Formata dados da CNPJa para o padrão do nosso sistema
 */
function mapCnpjaToSystem(record, nicho) {
    let telefone = null;
    if (record.phones && record.phones.length > 0) {
        telefone = `(${record.phones[0].area}) ${record.phones[0].number}`;
    }

    let email = null;
    if (record.emails && record.emails.length > 0) {
        email = record.emails[0].address;
    }

    let socios = [];
    if (record.company && record.company.members) {
        socios = record.company.members.map(m => ({
            nome: m.person?.name || "Sócio",
            qualificacao: m.role?.text || "Sócio"
        }));
    }

    let capital = "---";
    if (record.company && record.company.equity) {
        try {
            capital = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(record.company.equity);
        } catch (e) {}
    }

    return {
        cnpj: record.taxId?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
        razao_social: record.company?.name || record.alias || "Empresa",
        nome_fantasia: record.alias || record.company?.name || "Empresa",
        nicho: nicho,
        status: record.status?.text || "Ativa",
        data_abertura: record.founded || "---",
        capital_social: capital,
        porte: record.company?.size?.text || "---",
        socios: socios,
        endereco: {
            logradouro: `${record.address?.street || ''}, ${record.address?.number || ''}`,
            municipio: record.address?.city || '',
            uf: record.address?.state || '',
            cep: record.address?.zip || ''
        },
        contato: {
            email: email,
            telefone: telefone,
            site: null
        },
        score_enrichment: 100, // Dados oficiais
        origin: 'cnpja_direct'
    };
}

/**
 * BUSCA E ENRIQUECIMENTO (GOOGLE + CNPJa)
 */
async function findAndEnrichWithCnpja(companyName, state) {
    if (!companyName) return null;

    try {
        const params = {
            'names.in': companyName,
            limit: 1 
        };
        if (state) params['address.state.in'] = state;

        const response = await axios.get('https://api.cnpja.com/office', {
            headers: { 'Authorization': CNPJA_API_KEY },
            params: params,
            timeout: 10000 
        });

        if (response.data && response.data.records && response.data.records.length > 0) {
            return response.data.records[0];
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * BUSCA DIRETA NA CNPJa (FALLBACK)
 * Usado quando o Google falha. Pesquisa empresas que tenham o "Nicho" no nome.
 */
async function searchDirectlyInCnpja(niche, location) {
    console.log(`[FALLBACK] Buscando diretamente na CNPJa: ${niche} em ${location}`);
    
    const uf = extractStateFromLocation(location);
    const params = {
        'alias.in': niche, // Tenta achar o nicho no nome fantasia
        limit: 10
    };

    if (uf) {
        params['address.state.in'] = uf;
    }

    try {
        // Primeira tentativa: Busca por Nome Fantasia contendo o termo
        const response = await axios.get('https://api.cnpja.com/office', {
            headers: { 'Authorization': CNPJA_API_KEY },
            params: params,
            timeout: 20000
        });

        let records = response.data.records || [];

        // Se não achou nada, tenta buscar por Razão Social
        if (records.length === 0) {
            delete params['alias.in'];
            params['company.name.in'] = niche;
            const response2 = await axios.get('https://api.cnpja.com/office', {
                headers: { 'Authorization': CNPJA_API_KEY },
                params: params,
                timeout: 20000
            });
            records = response2.data.records || [];
        }

        return records.map(r => mapCnpjaToSystem(r, niche));

    } catch (error) {
        console.error("[FALLBACK ERROR]", error.message);
        return [];
    }
}

async function processGoogleLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    const address = place.formattedAddress || "";
    // Tenta extrair UF do endereço do Google
    const state = extractStateFromLocation(address);
    
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
            logradouro: address,
            municipio: location,
            uf: state || "BR",
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
        const officialData = await findAndEnrichWithCnpja(rawName, state);
        if (officialData) {
            // Mescla dados oficiais se encontrar
            const enriched = mapCnpjaToSystem(officialData, niche);
            // Mantém telefone/site do Google se o oficial não tiver
            if (!enriched.contato.telefone && companyData.contato.telefone) enriched.contato.telefone = companyData.contato.telefone;
            if (companyData.contato.site) enriched.contato.site = companyData.contato.site;
            return enriched;
        } 
    } catch (e) {
        console.error(`Erro processando ${rawName}`, e.message);
    }

    return companyData;
}

// --- ROTAS DA API ---

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', uptime: process.uptime() });
});

app.post('/api/start-search', async (req, res) => {
    const { niche, location } = req.body;
    
    if (!niche || !location) return res.status(400).json({ error: "Faltam parâmetros" });

    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, startTime: Date.now(), status: 'running', results: [], error: null };

    res.json({ jobId, message: "Busca iniciada em background" });

    (async () => {
        try {
            console.log(`[JOB ${jobId}] Iniciando busca Google: ${niche} - ${location}`);
            
            // TENTATIVA 1: GOOGLE PLACES
            const googleResponse = await axios.post(
                'https://places.googleapis.com/v1/places:searchText',
                { textQuery: `${niche} em ${location}`, pageSize: 10 },
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

            if (places.length > 0) {
                // Processa resultados do Google
                for (const place of places) {
                    if (!jobs[jobId]) break;
                    await wait(300); 
                    const result = await processGoogleLead(place, niche, location);
                    jobs[jobId].results.push(result);
                }
            } else {
                throw new Error("Google retornou 0 resultados");
            }

        } catch (error) {
            console.error(`[JOB ${jobId}] Erro no Google (${error.message || error.response?.status}). Ativando Fallback CNPJa...`);
            
            // TENTATIVA 2: FALLBACK DIRETO CNPJa (Se Google falhar ou bloquear)
            try {
                const directResults = await searchDirectlyInCnpja(niche, location);
                
                if (directResults.length > 0) {
                     if (jobs[jobId]) jobs[jobId].results.push(...directResults);
                } else {
                     if (jobs[jobId]) jobs[jobId].error = "Nenhum lead encontrado nas bases oficiais.";
                }

            } catch (fallbackError) {
                console.error(`[JOB ${jobId}] Erro no Fallback:`, fallbackError.message);
                if (jobs[jobId]) jobs[jobId].error = "Falha em todas as fontes de dados.";
            }
        } finally {
            if (jobs[jobId]) jobs[jobId].status = 'completed';
        }
    })();
});

app.get('/api/check-search/:id', (req, res) => {
    const job = jobs[req.params.id];
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    res.json(job);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
