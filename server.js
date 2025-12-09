require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

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

// --- BANCO DE DADOS SIMPLES (EM MEMÓRIA/ARQUIVO) ---
const DB_FILE = 'database.json';
let DB = {
    users: [
        { id: '1', username: 'admin', password: '123', role: 'admin', createdAt: Date.now() }
    ],
    history: {},     // { userId: [items] }
    savedLeads: {},  // { userId: [leads] }
    dailyCounts: {}  // { date_userId: count }
};

// Carrega DB do arquivo se existir
if (fs.existsSync(DB_FILE)) {
    try {
        const data = fs.readFileSync(DB_FILE);
        DB = JSON.parse(data);
    } catch (e) {
        console.error("Erro ao carregar DB:", e);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
    } catch (e) {
        console.error("Erro ao salvar DB:", e);
    }
}

// Jobs de busca em background
const jobs = {}; 

setInterval(() => {
    const now = Date.now();
    for (const id in jobs) {
        if (now - jobs[id].startTime > 15 * 60 * 1000) { 
            delete jobs[id];
        }
    }
}, 600000);

// --- ROTAS DE DADOS (CENTRALIZAÇÃO) ---

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = DB.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const { password, ...safeUser } = user;
        res.json({ success: true, user: safeUser });
    } else {
        res.status(401).json({ success: false, message: "Credenciais inválidas" });
    }
});

// Sincronizar Dados
app.get('/api/data/sync/:userId', (req, res) => {
    const { userId } = req.params;
    
    const today = new Date().toDateString();
    const dailyKey = `${today}_${userId}`;
    const dailyCount = DB.dailyCounts[dailyKey] || 0;

    res.json({
        history: DB.history[userId] || [],
        savedLeads: DB.savedLeads[userId] || [],
        dailyCount: dailyCount
    });
});

// Salvar Histórico
app.post('/api/data/history', (req, res) => {
    const { userId, item } = req.body;
    if (!DB.history[userId]) DB.history[userId] = [];
    DB.history[userId].unshift(item);
    
    const today = new Date().toDateString();
    const dailyKey = `${today}_${userId}`;
    if (!DB.dailyCounts[dailyKey]) DB.dailyCounts[dailyKey] = 0;
    DB.dailyCounts[dailyKey] += item.resultCount;

    saveDB();
    res.json({ success: true, dailyCount: DB.dailyCounts[dailyKey] });
});

// Excluir Histórico
app.delete('/api/data/history/:userId/:itemId', (req, res) => {
    const { userId, itemId } = req.params;
    if (DB.history[userId]) {
        DB.history[userId] = DB.history[userId].filter(i => i.id !== itemId);
        saveDB();
    }
    res.json({ success: true });
});

app.delete('/api/data/history/clear/:userId', (req, res) => {
    const { userId } = req.params;
    DB.history[userId] = [];
    saveDB();
    res.json({ success: true });
});

// Leads Salvos
app.post('/api/data/leads', (req, res) => {
    const { userId, lead } = req.body;
    if (!DB.savedLeads[userId]) DB.savedLeads[userId] = [];
    
    if (!DB.savedLeads[userId].some(l => l.cnpj === lead.cnpj)) {
        DB.savedLeads[userId].unshift(lead);
        saveDB();
    }
    res.json({ success: true });
});

app.delete('/api/data/leads/:userId/:cnpj', (req, res) => {
    const { userId, cnpj } = req.params;
    if (DB.savedLeads[userId]) {
        DB.savedLeads[userId] = DB.savedLeads[userId].filter(l => l.cnpj !== cnpj);
        saveDB();
    }
    res.json({ success: true });
});

// Gestão de Usuários
app.get('/api/users', (req, res) => {
    res.json(DB.users.map(({password, ...u}) => u));
});

app.post('/api/users', (req, res) => {
    const newUser = req.body;
    if (DB.users.some(u => u.username === newUser.username)) {
        return res.status(400).json({ error: "Usuário já existe" });
    }
    DB.users.push(newUser);
    saveDB();
    res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const index = DB.users.findIndex(u => u.id === id);
    
    if (index !== -1) {
        DB.users[index] = { ...DB.users[index], ...updates };
        saveDB();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Usuário não encontrado" });
    }
});

app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    DB.users = DB.users.filter(u => u.id !== id);
    saveDB();
    res.json({ success: true });
});


// --- LÓGICA DE BUSCA ---

const REGION_MAP = {
    'SUDESTE': ['SP', 'RJ', 'MG', 'ES'],
    'SUL': ['PR', 'RS', 'SC'],
    'NORDESTE': ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI'],
    'CENTRO_OESTE': ['DF', 'GO', 'MT', 'MS'],
    'NORTE': ['AM', 'PA', 'AC', 'RR', 'RO', 'AP', 'TO']
};

function normalizeString(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function requestWithRetry(url, config, retries = 3, baseDelay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            await new Promise(r => setTimeout(r, baseDelay));
            return await axios.get(url, config);
        } catch (error) {
            const isRateLimit = error.response && error.response.status === 429;
            const isLastAttempt = i === retries - 1;
            if (isRateLimit && !isLastAttempt) {
                const waitTime = (i + 1) * 5000; 
                console.log(`[API] Rate Limit (429) detectado. Aguardando ${waitTime/1000}s...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            throw error;
        }
    }
}

function mapCnpjaToSystem(record, nicho, origin = 'cnpja_direct') {
    let telefone = null;
    if (record.phones && record.phones.length > 0) {
        const mobile = record.phones.find(p => p.type === 'MOBILE');
        const phone = mobile || record.phones[0];
        telefone = `(${phone.area}) ${phone.number}`;
    }

    let email = null;
    if (record.emails && record.emails.length > 0) {
        email = record.emails[0].address;
    }

    let socios = [];
    if (record.company && record.company.members) {
        socios = record.company.members.map(m => ({
            nome: m.person?.name || m.name || "Sócio não informado",
            qualificacao: m.role?.text || m.qualificacao || "Sócio"
        }));
    } else if (record.members) {
         // Fallback para estrutura plana se existir
         socios = record.members.map(m => ({
            nome: m.person?.name || m.name || "Sócio não informado",
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
        origin: origin
    };
}

function isLeadQualified(lead) {
    return lead.contato.email && lead.contato.telefone;
}

async function searchGoogleAndEnrich(niche, city, uf, limit = 10) {
    console.log(`[SNIPER] Buscando no Google: ${niche} em ${city} ${uf} (Limite: ${limit})`);
    const results = [];

    try {
        const googleResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchText',
            { textQuery: `${niche} em ${city} ${uf}`, pageSize: Math.min(limit * 3, 20) }, // Busca mais no Google para garantir filtragem
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress'
                },
                timeout: 10000
            }
        );

        const places = googleResponse.data.places || [];
        console.log(`[SNIPER] Google encontrou ${places.length} locais.`);

        if (places.length === 0) return []; 

        for (const place of places) {
            if (results.length >= limit) break;
            const companyName = place.displayName.text;
            
            try {
                // Aguarda 4s entre requisições para evitar rate limit
                await new Promise(r => setTimeout(r, 4000));
                
                const cnpjaResponse = await requestWithRetry('https://api.cnpja.com/office', {
                    headers: { 'Authorization': CNPJA_API_KEY },
                    params: {
                        'names.in': companyName,
                        'address.state.in': uf,
                        'emails.ex': true,
                        'phones.ex': true,
                        limit: 1
                    },
                    timeout: 20000
                }, 3, 15000); 

                const records = cnpjaResponse.data.records || [];
                
                if (records.length > 0) {
                    const lead = mapCnpjaToSystem(records[0], niche, 'google_enriched');
                    const leadCity = normalizeString(lead.endereco.municipio);
                    const targetCity = normalizeString(city);

                    if (isLeadQualified(lead)) {
                         // Validação estrita de cidade
                         if (leadCity.includes(targetCity) || targetCity.includes(leadCity)) {
                            // Evita duplicatas dentro do próprio sniper
                            if (!results.some(r => r.cnpj === lead.cnpj)) {
                                results.push(lead);
                            }
                         }
                    }
                }
            } catch (enrichErr) {
                console.error(`[SNIPER] Falha ao enriquecer "${companyName}": ${enrichErr.message}`);
            }
        }
    } catch (err) {
        console.error(`[SNIPER] Erro no Google Places: ${err.message}`);
        return [];
    }
    return results;
}

async function searchDirectlyInCnpja(niche, ufs, cityFilter = null, limit = 10) {
    const targetUfs = Array.isArray(ufs) ? ufs : [ufs];
    const allResults = [];
    
    console.log(`[DEEP SCAN] Buscando ${limit} leads em ${targetUfs.join(',')}...`);

    const MAX_UFS_TO_SEARCH = targetUfs.length > 3 ? 3 : targetUfs.length; 
    const MAX_PAGES_PER_UF = cityFilter ? 5 : 3; 

    for (let i = 0; i < MAX_UFS_TO_SEARCH; i++) {
        if (allResults.length >= limit) break;
        const uf = targetUfs[i];
        let nextToken = null;
        let pageCount = 0;

        do {
            if (allResults.length >= limit) break;

            const params = {
                'address.state.in': uf,
                'status.id.in': 2, 
                'emails.ex': true, 
                'phones.ex': true,
                limit: 100 
            };
            if (nextToken) params.token = nextToken;
            else params['names.in'] = niche;
            
            try {
                // Delay menor para busca em lote
                await new Promise(r => setTimeout(r, 1000));
                
                const response = await requestWithRetry('https://api.cnpja.com/office', {
                    headers: { 'Authorization': CNPJA_API_KEY },
                    params: params,
                    timeout: 45000 
                }, 3, 2000); 

                const records = response.data.records || [];
                nextToken = response.data.next; 
                pageCount++;

                const mapped = records.map(r => mapCnpjaToSystem(r, niche, 'deep_scan'));
                const filtered = mapped.filter(lead => {
                    if (!isLeadQualified(lead)) return false;
                    if (cityFilter) {
                        const leadCity = normalizeString(lead.endereco.municipio);
                        const targetCity = normalizeString(cityFilter);
                        if (!leadCity.includes(targetCity) && !targetCity.includes(leadCity)) return false;
                    }
                    return true;
                });

                for (const lead of filtered) {
                    if (allResults.length < limit) {
                        if (!allResults.some(r => r.cnpj === lead.cnpj)) {
                            allResults.push(lead);
                        }
                    } else break;
                }
            } catch (error) {
                console.error(`[DEEP SCAN] Erro na UF ${uf}:`, error.message);
                break; 
            }

        } while (nextToken && pageCount < MAX_PAGES_PER_UF && allResults.length < limit);
    }
    return allResults;
}

app.get('/api/status', (req, res) => {
    console.log("[SERVER] Wake up call received");
    res.json({ status: 'online' });
});

app.post('/api/start-search', async (req, res) => {
    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, startTime: Date.now(), status: 'running', results: [], error: null };
    
    // Resposta imediata para evitar timeout do navegador
    res.json({ jobId, message: "Busca iniciada" });

    // Processamento assíncrono desbloqueado
    setTimeout(async () => {
        const { niche, location, region_type, selected_uf, selected_region, limit = 10 } = req.body;
        
        let targetUfs = [];
        let cityFilter = null;
        let cityName = "";

        if (region_type === 'cidade') {
            targetUfs = [selected_uf || 'SP'];
            const parts = location.split(' ');
            if (parts.length > 1 && parts[parts.length-1].length === 2) parts.pop(); 
            cityName = parts.join(' ').replace(',', '').trim();
            cityFilter = cityName;
        } else if (region_type === 'estado') {
            targetUfs = [selected_uf];
        } else if (region_type === 'regiao') {
            targetUfs = REGION_MAP[selected_region] || ['SP'];
        }

        try {
            let finalResults = [];

            // 1. TENTA GOOGLE (SNIPER) SE FOR CIDADE
            if (region_type === 'cidade' && cityName) {
                const googleResults = await searchGoogleAndEnrich(niche, cityName, targetUfs[0], limit);
                if (googleResults && googleResults.length > 0) {
                    finalResults.push(...googleResults);
                }
            }

            // 2. COMPLEMENTO INTELIGENTE (Se não atingiu o limite, busca mais via Deep Scan)
            if (finalResults.length < limit) {
                const remaining = limit - finalResults.length;
                console.log(`[COMPLEMENTO] Encontrados ${finalResults.length} leads. Buscando mais ${remaining} via Deep Scan...`);
                
                // Deep scan usa cityFilter para tentar filtrar pela cidade na busca ampla
                // Se não for busca por cidade, cityFilter é null, então busca no estado/região
                const directResults = await searchDirectlyInCnpja(niche, targetUfs, cityFilter, remaining);
                
                // Filtra duplicados (caso o Google tenha achado algo que o Deep Scan também ache)
                for (const lead of directResults) {
                     if (!finalResults.some(r => r.cnpj === lead.cnpj)) {
                         finalResults.push(lead);
                     }
                     if (finalResults.length >= limit) break;
                }
            }
            
            if (finalResults.length > 0) {
                jobs[jobId].results = finalResults;
            } else {
                let msg = `Nenhum lead com Email e Telefone encontrado para "${niche}"`;
                if (cityFilter) msg += ` em ${cityFilter}`;
                jobs[jobId].error = msg + ". Tente expandir a busca para o Estado.";
            }
        } catch (error) {
            console.error(`[JOB ${jobId}] Erro Fatal:`, error);
            jobs[jobId].error = "Erro interno no servidor ao processar busca.";
        } finally {
            jobs[jobId].status = 'completed';
        }
    }, 100); 
});

app.get('/api/check-search/:id', (req, res) => {
    const job = jobs[req.params.id];
    if (!job) return res.status(404).json({ error: "Job expirado ou não encontrado" });
    res.json(job);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
