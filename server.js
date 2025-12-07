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

/**
 * FUNÇÃO DE REQUISIÇÃO SEGURA COM RETRY (Trata Erro 429)
 */
async function requestWithRetry(url, config, retries = 3, baseDelay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Delay respeitoso antes de qualquer chamada
            await new Promise(r => setTimeout(r, baseDelay));
            return await axios.get(url, config);
        } catch (error) {
            const isRateLimit = error.response && error.response.status === 429;
            const isLastAttempt = i === retries - 1;

            if (isRateLimit && !isLastAttempt) {
                const waitTime = (i + 1) * 5000; // 5s, 10s, 15s...
                console.log(`[API] Rate Limit (429) detectado. Aguardando ${waitTime/1000}s para tentar novamente...`);
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
        // Pega preferencialmente celular
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
        origin: origin
    };
}

/**
 * Verifica se o lead é qualificado (Tem email E telefone)
 */
function isLeadQualified(lead) {
    return lead.contato.email && lead.contato.telefone;
}

/**
 * ESTRATÉGIA SNIPER: Google Places -> CNPJa Enrichment
 * Usa o Google para achar locais exatos e a CNPJa para pegar dados.
 */
async function searchGoogleAndEnrich(niche, city, uf) {
    console.log(`[SNIPER] Buscando no Google: ${niche} em ${city} ${uf}`);
    const results = [];

    try {
        // 1. Busca no Google Places API (New)
        const googleResponse = await axios.post(
            'https://places.googleapis.com/v1/places:searchText',
            {
                textQuery: `${niche} em ${city} ${uf}`,
                pageSize: 20 // Pega os top 20 do Google
            },
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

        if (places.length === 0) return null; // Retorna null para ativar fallback

        // 2. Enriquecimento via CNPJa (Com Rate Limit Controlado e Validação de Cidade)
        for (const place of places) {
            const companyName = place.displayName.text;
            
            try {
                // Usa a função helper com retry automático
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
                }, 3, 4000); // 3 tentativas, 4s de delay base (Mais lento para evitar 429)

                const records = cnpjaResponse.data.records || [];
                
                if (records.length > 0) {
                    const lead = mapCnpjaToSystem(records[0], niche, 'google_enriched');
                    
                    // Validação Estrita de Cidade (Evita Matriz em outra cidade)
                    const leadCity = normalizeString(lead.endereco.municipio);
                    const targetCity = normalizeString(city);

                    if (isLeadQualified(lead)) {
                         // Verifica se a cidade do lead contem a cidade alvo ou vice versa
                         if (leadCity.includes(targetCity) || targetCity.includes(leadCity)) {
                            results.push(lead);
                         } else {
                            console.log(`[SNIPER] Ignorado: ${lead.nome_fantasia} é de ${lead.endereco.municipio} (Alvo: ${city})`);
                         }
                    }
                }

            } catch (enrichErr) {
                console.error(`[SNIPER] Falha ao enriquecer "${companyName}": ${enrichErr.message}`);
                // Continua para o próximo mesmo com erro
            }
        }

    } catch (err) {
        console.error(`[SNIPER] Erro no Google Places: ${err.message}`);
        return null; // Retorna null para indicar que falhou e deve usar fallback
    }

    return results;
}

/**
 * ESTRATÉGIA DEEP SCAN: Busca direta na CNPJa (Backup ou para Estados/Regiões)
 */
async function searchDirectlyInCnpja(niche, ufs, cityFilter = null) {
    const targetUfs = Array.isArray(ufs) ? ufs : [ufs];
    const allResults = [];
    
    // Limite de segurança
    const MAX_UFS_TO_SEARCH = targetUfs.length > 3 ? 3 : targetUfs.length; 
    const MAX_PAGES_PER_UF = cityFilter ? 5 : 2; // Menos páginas se for estado, mais se for cidade

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
                'emails.ex': true, 
                'phones.ex': true,
                limit: 100 
            };

            if (nextToken) {
                params.token = nextToken;
            } else {
                params['names.in'] = niche;
            }
            
            try {
                // Usa função helper com retry
                const response = await requestWithRetry('https://api.cnpja.com/office', {
                    headers: { 'Authorization': CNPJA_API_KEY },
                    params: params,
                    timeout: 45000 
                }, 3, 2000); // Delay maior para listagem massiva (2s)

                const records = response.data.records || [];
                nextToken = response.data.next; 
                pageCount++;

                const mapped = records.map(r => mapCnpjaToSystem(r, niche));
                
                const filtered = mapped.filter(lead => {
                    if (!isLeadQualified(lead)) return false;
                    if (cityFilter) {
                        const leadCity = normalizeString(lead.endereco.municipio);
                        const targetCity = normalizeString(cityFilter);
                        if (!leadCity.includes(targetCity) && !targetCity.includes(leadCity)) return false;
                    }
                    return true;
                });

                allResults.push(...filtered);
                foundInUf += filtered.length;
                
                console.log(`[CNPJa] ${uf} Página ${pageCount}: Encontrados ${filtered.length} leads qualificados.`);

                // Se achamos bastante, paramos para não gastar créditos/tempo à toa
                if (foundInUf >= 50) break;

            } catch (error) {
                console.error(`Erro buscando em ${uf} na página ${pageCount}:`, error.message);
                break; 
            }

        } while (nextToken && pageCount < MAX_PAGES_PER_UF);
        
        if (allResults.length >= 100) break;
    }

    return allResults;
}


// --- ROTAS ---

app.get('/api/status', (req, res) => {
    res.json({ status: 'online' });
});

app.post('/api/start-search', async (req, res) => {
    const jobId = crypto.randomUUID();
    jobs[jobId] = { id: jobId, startTime: Date.now(), status: 'running', results: [], error: null };
    
    // RESPOSTA IMEDIATA
    res.json({ jobId, message: "Busca iniciada" });

    setTimeout(async () => {
        const { niche, location, region_type, selected_uf, selected_region } = req.body;
        
        let targetUfs = [];
        let cityFilter = null;
        let cityName = "";

        if (region_type === 'cidade') {
            targetUfs = [selected_uf || 'SP'];
            const parts = location.split(' ');
            if (parts.length > 1 && parts[parts.length-1].length === 2) {
                 parts.pop(); 
            }
            cityName = parts.join(' ').replace(',', '').trim();
            cityFilter = cityName;
        } else if (region_type === 'estado') {
            targetUfs = [selected_uf];
        } else if (region_type === 'regiao') {
            targetUfs = REGION_MAP[selected_region] || ['SP'];
        }

        try {
            console.log(`[JOB ${jobId}] Iniciando. Tipo: ${region_type}. Nicho: ${niche}`);

            let results = null;

            // 1. TENTA ESTRATÉGIA SNIPER (GOOGLE) SE FOR BUSCA POR CIDADE
            if (region_type === 'cidade' && cityName) {
                results = await searchGoogleAndEnrich(niche, cityName, targetUfs[0]);
            }

            // 2. FALLBACK PARA DEEP SCAN (CNPJa DIRETO)
            // Se o Google falhou (null) ou retornou vazio, ou se é busca por Estado/Região
            if (!results || results.length === 0) {
                // Só ativa Deep Scan se o Sniper falhou totalmente (erro) ou se não achou nada
                // Se o sniper rodou e achou 0, as vezes é melhor confiar nele do que gastar API.
                // Mas aqui vamos garantir resultados.
                
                if (region_type === 'cidade') console.log(`[JOB ${jobId}] Sniper falhou ou sem resultados. Ativando Deep Scan (CNPJa Direto)...`);
                results = await searchDirectlyInCnpja(niche, targetUfs, cityFilter);
            }
            
            if (results && results.length > 0) {
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
