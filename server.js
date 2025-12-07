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
    const targetUfs = Array.isArray(ufs) ? ufs : [ufs];
    const allResults = [];
    
    // Limite de segurança
    const MAX_UFS_TO_SEARCH = targetUfs.length > 3 ? 3 : targetUfs.length; 
    
    // Configuração do Deep Scan (Paginação)
    // Se for busca por cidade específica, procuramos mais fundo (até 10 páginas = 1000 empresas)
    const MAX_PAGES_PER_UF = cityFilter ? 10 : 2; 

    for (let i = 0; i < MAX_UFS_TO_SEARCH; i++) {
        const uf = targetUfs[i];
        let nextToken = null;
        let pageCount = 0;
        let foundInUf = 0;

        console.log(`[CNPJa] Iniciando Deep Scan em ${uf} para: ${niche} (Cidade alvo: ${cityFilter || 'Todas'})...`);

        do {
            const params = {
                'address.state.in': uf,
                'status.id.in': 2, // Apenas ATIVA
                'emails.ex': true, // OBRIGATÓRIO TER EMAIL
                'phones.ex': true, // OBRIGATÓRIO TER TELEFONE
                limit: 100 // Máximo por página
            };

            // Se tiver token de paginação, usa ele
            if (nextToken) {
                params.token = nextToken;
            } else {
                // Primeira página: configura termos de busca
                // Tenta buscar por termo genérico "niche" nos nomes
                params['names.in'] = niche;
            }
            
            try {
                const response = await axios.get('https://api.cnpja.com/office', {
                    headers: { 'Authorization': CNPJA_API_KEY },
                    params: params,
                    timeout: 45000 // Timeout longo para garantir
                });

                const records = response.data.records || [];
                nextToken = response.data.next; // Pega o token para a próxima página
                pageCount++;

                // Mapeia e Filtra
                const mapped = records.map(r => mapCnpjaToSystem(r, niche));
                
                const filtered = mapped.filter(lead => {
                    // 1. Filtro de Qualificação
                    if (!isLeadQualified(lead)) return false;

                    // 2. Filtro de Cidade (CRÍTICO)
                    if (cityFilter) {
                        const leadCity = normalizeString(lead.endereco.municipio);
                        const targetCity = normalizeString(cityFilter);
                        
                        // Verifica se a cidade bate
                        if (!leadCity.includes(targetCity) && !targetCity.includes(leadCity)) return false;
                    }

                    return true;
                });

                allResults.push(...filtered);
                foundInUf += filtered.length;
                
                console.log(`[CNPJa] ${uf} Página ${pageCount}: Encontrados ${filtered.length} leads qualificados de ${records.length} brutos.`);

                // Se já achou o suficiente nesta UF, para de paginar
                if (foundInUf >= 50) break;

            } catch (error) {
                console.error(`Erro buscando em ${uf} na página ${pageCount}:`, error.message);
                break; // Se der erro, pula para próxima UF
            }

            // Delayzinho para não tomar Rate Limit da API
            await new Promise(r => setTimeout(r, 200));

        } while (nextToken && pageCount < MAX_PAGES_PER_UF);
        
        // Se já temos total suficiente globalmente, para
        if (allResults.length >= 100) break;
    }

    return allResults;
}


// --- ROTAS ---

app.get('/api/status', (req, res) => {
    // Resposta ultra leve para wake up
    res.json({ status: 'online' });
});

app.post('/api/start-search', async (req, res) => {
    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, startTime: Date.now(), status: 'running', results: [], error: null };
    
    // RESPOSTA IMEDIATA (Critical para evitar timeout do Render/Browser)
    res.json({ jobId, message: "Busca iniciada" });

    // Processamento Assíncrono Desacoplado
    // setTimeout(0) coloca isso no final do Event Loop, garantindo que o res.json saia antes.
    setTimeout(async () => {
        const { niche, location, region_type, selected_uf, selected_region } = req.body;
        
        let targetUfs = [];
        let cityFilter = null;

        if (region_type === 'cidade') {
            targetUfs = [selected_uf || 'SP'];
            const parts = location.split(' ');
            if (parts.length > 1 && parts[parts.length-1].length === 2) {
                 parts.pop(); 
            }
            cityFilter = parts.join(' ').replace(',', '').trim();
        } else if (region_type === 'estado') {
            targetUfs = [selected_uf];
        } else if (region_type === 'regiao') {
            targetUfs = REGION_MAP[selected_region] || ['SP'];
        }

        try {
            console.log(`[JOB ${jobId}] Iniciando Deep Scan. Tipo: ${region_type}. Nicho: ${niche}`);

            const results = await searchDirectlyInCnpja(niche, targetUfs, cityFilter);
            
            if (results.length > 0) {
                jobs[jobId].results.push(...results);
            } else {
                let msg = `Nenhum lead com Email e Telefone encontrado para "${niche}"`;
                if (cityFilter) msg += ` em ${cityFilter}`;
                jobs[jobId].error = msg + ". Tente expandir para o Estado.";
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
