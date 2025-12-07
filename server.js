require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Proteção contra crash
process.on('uncaughtException', (err) => {
  console.error('[SERVER CRASH PREVENTED]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Chaves
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";
const CNPJA_API_KEY = process.env.CNPJA_API_KEY || "50cd7f37-a8a7-4076-b180-520a12dfdc3c-608f7b7f-2488-44b9-81f5-017cf47d154b";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const jobs = {}; 

setInterval(() => {
    const now = Date.now();
    for (const id in jobs) {
        if (now - jobs[id].startTime > 15 * 60 * 1000) { 
            delete jobs[id];
        }
    }
}, 600000);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- MAPAS DE REGIÃO ---
const REGION_MAP = {
    'SUDESTE': ['SP', 'RJ', 'MG', 'ES'],
    'SUL': ['PR', 'RS', 'SC'],
    'NORDESTE': ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'],
    'CENTRO_OESTE': ['DF', 'GO', 'MT', 'MS'],
    'NORTE': ['AM', 'PA', 'AC', 'RR', 'RO', 'AP', 'TO']
};

/**
 * Remove acentos para comparação de strings
 */
function normalizeString(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function mapCnpjaToSystem(record, nicho) {
    let telefone = null;
    if (record.phones && record.phones.length > 0) {
        // Pega preferencialmente celular
        const mobile = record.phones.find(p => p.type === 'MOBILE');
        const phone = mobile || record.phones[0];
        telefone = `(${phone.area}) ${phone.number}`;
    }

    let email = null;
    if (record.emails && record.emails.length > 0) {
        // Filtra emails de contadores se possível, mas pega o primeiro disponível
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

    let cnae = "---";
    if (record.mainActivity) {
        cnae = `${record.mainActivity.id} - ${record.mainActivity.text}`;
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
        cnae: cnae,
        score_enrichment: 100,
        origin: 'cnpja_direct'
    };
}

/**
 * Verifica se o lead é qualificado (Tem email E telefone)
 */
function isLeadQualified(lead) {
    return lead.contato.email && lead.contato.telefone;
}

async function searchDirectlyInCnpja(niche, ufs, cityFilter = null) {
    // Se ufs for string unica, transforma em array
    const targetUfs = Array.isArray(ufs) ? ufs : [ufs];
    const allResults = [];

    // Limite de segurança para não estourar tempo
    const MAX_UFS_TO_SEARCH = targetUfs.length > 3 ? 3 : targetUfs.length; 

    for (let i = 0; i < MAX_UFS_TO_SEARCH; i++) {
        const uf = targetUfs[i];
        
        console.log(`[CNPJa] Buscando ${niche} em ${uf} (Com Email/Tel Obrigatórios)...`);

        const params = {
            'alias.in': niche,
            'address.state.in': uf,
            'status.id.in': 2, // Apenas ATIVA
            'emails.ex': true, // OBRIGATÓRIO TER EMAIL (Filtro na API)
            'phones.ex': true, // OBRIGATÓRIO TER TELEFONE (Filtro na API)
            limit: 100 // AUMENTADO PARA 100 (Máximo) para achar cidades especificas
        };
        
        try {
            // Tentativa 1: Nome Fantasia
            let response = await axios.get('https://api.cnpja.com/office', {
                headers: { 'Authorization': CNPJA_API_KEY },
                params: params,
                timeout: 20000 // 20s timeout
            });

            let records = response.data.records || [];

            // Tentativa 2: Razão Social (se vier pouco na primeira)
            if (records.length < 20) {
                delete params['alias.in'];
                params['company.name.in'] = niche;
                try {
                    const response2 = await axios.get('https://api.cnpja.com/office', {
                        headers: { 'Authorization': CNPJA_API_KEY },
                        params: params,
                        timeout: 20000
                    });
                    const moreRecords = response2.data.records || [];
                    // Junta sem duplicatas
                    const existingIds = new Set(records.map(r => r.taxId));
                    moreRecords.forEach(r => {
                        if (!existingIds.has(r.taxId)) records.push(r);
                    });
                } catch (e) { /* ignore */ }
            }

            // Processamento e Filtragem Rigorosa
            const mapped = records.map(r => mapCnpjaToSystem(r, niche));
            
            const filtered = mapped.filter(lead => {
                // 1. Filtro de Qualificação (Email + Telefone) - Redundante mas seguro
                if (!isLeadQualified(lead)) return false;

                // 2. Filtro de Cidade (Se aplicável)
                if (cityFilter) {
                    const leadCity = normalizeString(lead.endereco.municipio);
                    const targetCity = normalizeString(cityFilter);
                    
                    // Lógica estrita: A cidade TEM que bater
                    if (!leadCity.includes(targetCity) && !targetCity.includes(leadCity)) return false;
                }

                return true;
            });

            allResults.push(...filtered);

        } catch (error) {
            console.error(`Erro buscando em ${uf}:`, error.message);
        }
        
        // Se já achou o suficiente, para
        if (allResults.length >= 50) break;
    }

    return allResults;
}


// --- ROTAS ---

app.get('/api/status', (req, res) => {
    res.json({ status: 'online' });
});

app.post('/api/start-search', async (req, res) => {
    const { niche, location, region_type, selected_uf, selected_region } = req.body;
    
    // Tratamento de parâmetros dependendo do tipo de busca
    let targetUfs = [];
    let cityFilter = null;

    if (region_type === 'cidade') {
        targetUfs = [selected_uf || 'SP'];
        // Remove a UF da string location se ela vier "Boituva SP" -> "Boituva"
        const parts = location.split(' ');
        if (parts.length > 1 && parts[parts.length-1].length === 2) {
             parts.pop(); // Tira a UF
        }
        cityFilter = parts.join(' ').replace(',', '').trim();
    } else if (region_type === 'estado') {
        targetUfs = [selected_uf];
    } else if (region_type === 'regiao') {
        targetUfs = REGION_MAP[selected_region] || ['SP'];
    }

    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, startTime: Date.now(), status: 'running', results: [], error: null };

    res.json({ jobId, message: "Busca iniciada" });

    (async () => {
        try {
            console.log(`[JOB ${jobId}] Iniciando. Tipo: ${region_type}. Nicho: ${niche}`);

            // Busca diretamente na CNPJa
            const results = await searchDirectlyInCnpja(niche, targetUfs, cityFilter);
            
            if (results.length > 0) {
                jobs[jobId].results.push(...results);
            } else {
                jobs[jobId].error = `Nenhum lead qualificado encontrado. Tente buscar em uma região maior (ex: Estado) ou outro nicho.`;
            }

        } catch (error) {
            console.error(`[JOB ${jobId}] Erro Fatal:`, error);
            jobs[jobId].error = "Erro interno no servidor ao processar busca.";
        } finally {
            jobs[jobId].status = 'completed';
        }
    })();
});

app.get('/api/check-search/:id', (req, res) => {
    const job = jobs[req.params.id];
    if (!job) return res.status(404).json({ error: "Job expirado ou não encontrado" });
    res.json(job);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
