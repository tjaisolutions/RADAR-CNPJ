require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Chaves de API
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyC84DLI9J_TLNapOQEGHRjf9U9IlnCLUzA";
const CNPJA_API_KEY = process.env.CNPJA_API_KEY || "50cd7f37-a8a7-4076-b180-520a12dfdc3c-608f7b7f-2488-44b9-81f5-017cf47d154b";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- ARMAZENAMENTO DE JOBS EM MEMÓRIA ---
const jobs = {}; 

setInterval(() => {
    const now = Date.now();
    for (const id in jobs) {
        if (now - jobs[id].startTime > 10 * 60 * 1000) { 
            delete jobs[id];
        }
    }
}, 600000);

// --- FUNÇÕES UTILITÁRIAS ---

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extrai a UF (Estado) de um endereço formatado do Google
 * Ex: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100" -> "SP"
 */
function extractStateFromAddress(address) {
    if (!address) return null;
    // Procura por padrão " - UF," ou " - UF" ou "Estado - UF"
    const match = address.match(/[- ,]([A-Z]{2})\b/);
    // Lista de UFs válidas para evitar falsos positivos
    const validUFs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SP","SE","TO"];
    
    if (match && validUFs.includes(match[1])) {
        return match[1];
    }
    // Tentativa secundária: procurar UF no final da string se não tiver CEP
    const matchEnd = address.match(/\b([A-Z]{2})$/);
    if (matchEnd && validUFs.includes(matchEnd[1])) return matchEnd[1];
    
    return null;
}

/**
 * BUSCA E ENRIQUECIMENTO VIA CNPJa (Estratégia Blindada)
 */
async function findAndEnrichWithCnpja(companyName, state) {
    if (!companyName) return null;

    try {
        console.log(`[CNPJa] Buscando: "${companyName}" em "${state || 'BR'}"`);
        
        // Monta os parâmetros de busca
        const params = {
            'names.in': companyName, // Busca por Razão Social ou Fantasia
            limit: 1 // Queremos o melhor match
        };

        // Se tivermos o estado, filtramos para aumentar a precisão
        if (state) {
            params['address.state.in'] = state;
        }

        const response = await axios.get('https://api.cnpja.com/office', {
            headers: {
                'Authorization': CNPJA_API_KEY
            },
            params: params,
            timeout: 10000
        });

        if (response.data && response.data.records && response.data.records.length > 0) {
            return response.data.records[0]; // Retorna a primeira empresa encontrada
        }

        return null;

    } catch (error) {
        console.error(`[CNPJa Error] ${companyName}:`, error.message);
        return null;
    }
}

/**
 * PROCESSAMENTO DE UM LEAD
 */
async function processLead(place, niche, location) {
    const rawName = place.displayName?.text || "Nome Desconhecido";
    const address = place.formattedAddress || "";
    const state = extractStateFromAddress(address);
    
    // Objeto base com dados do Google
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
        // AQUI ESTÁ A MUDANÇA: Chamada direta à CNPJa
        const officialData = await findAndEnrichWithCnpja(rawName, state);

        if (officialData) {
            // Mapeamento dos dados oficiais da CNPJa para nosso formato
            companyData.cnpj = officialData.taxId?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
            companyData.razao_social = officialData.company?.name || rawName;
            companyData.nome_fantasia = officialData.alias || rawName;
            companyData.data_abertura = officialData.founded;
            companyData.status = officialData.status?.text || companyData.status;
            
            if (officialData.company?.equity) {
                try {
                    companyData.capital_social = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(officialData.company.equity);
                } catch (e) { companyData.capital_social = officialData.company.equity; }
            }

            companyData.porte = officialData.company?.size?.text || "---";

            // Contatos (CNPJa é excelente nisso)
            if (officialData.emails && officialData.emails.length > 0) {
                companyData.contato.email = officialData.emails[0].address;
            }
            if (officialData.phones && officialData.phones.length > 0) {
                const ph = officialData.phones[0];
                companyData.contato.telefone = `(${ph.area}) ${ph.number}`; // Prioriza telefone oficial
            }

            // Endereço Oficial
            if (officialData.address) {
                companyData.endereco.logradouro = `${officialData.address.street}, ${officialData.address.number}`;
                companyData.endereco.bairro = officialData.address.district;
                companyData.endereco.municipio = officialData.address.city;
                companyData.endereco.uf = officialData.address.state;
                companyData.endereco.cep = officialData.address.zip;
            }

            // Sócios (API retorna na estrutura members)
            /* Nota: A estrutura 'records' da lista '/office' às vezes não traz os sócios detalhados dependendo do plano,
               mas se vier, mapeamos. Se não, precisaríamos chamar /company/{id}, mas para performance vamos manter a lista.
               A CNPJa geralmente retorna o quadro societário na busca detalhada. 
               Para busca em lista, verificamos se 'company.members' existe. */
            if (officialData.company?.members) {
                companyData.socios = officialData.company.members.map(m => ({
                    nome: m.person?.name || "Sócio",
                    qualificacao: m.role?.text || "Sócio"
                }));
            }

            companyData.score_enrichment = 100;
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
        mode: 'cnpja_official',
        google_key_configured: !!GOOGLE_API_KEY,
        cnpja_key_configured: !!CNPJA_API_KEY
    });
});

app.post('/api/start-search', async (req, res) => {
    const { niche, location } = req.body;
    
    if (!niche || !location) {
        return res.status(400).json({ error: "Faltam parâmetros" });
    }

    const jobId = crypto.randomUUID();
    
    jobs[jobId] = {
        id: jobId,
        startTime: Date.now(),
        status: 'running',
        results: [],
        error: null
    };

    res.json({ jobId, message: "Busca iniciada em background" });

    (async () => {
        try {
            console.log(`[JOB ${jobId}] Iniciando busca Google: ${niche} - ${location}`);
            
            const googleResponse = await axios.post(
                'https://places.googleapis.com/v1/places:searchText',
                {
                    textQuery: `${niche} em ${location}`,
                    pageSize: 8 
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

            for (const place of places) {
                if (!jobs[jobId]) break;
                // Delay minúsculo apenas para não sobrecarregar em caso de muitos requests
                await wait(200); 
                const result = await processLead(place, niche, location);
                
                if (jobs[jobId]) {
                    jobs[jobId].results.push(result);
                }
            }

            if (jobs[jobId]) {
                jobs[jobId].status = 'completed';
                console.log(`[JOB ${jobId}] Concluído.`);
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
