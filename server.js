const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Chave da API (No Render, idealmente use Variáveis de Ambiente)
const API_KEY = "50cd7f37-a8a7-4076-b180-520a12dfdc3c-608f7b7f-2488-44b9-81f5-017cf47d154b";
const BASE_URL = "https://api.cnjpa.com/v1";

app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO PARA RENDER: Servir arquivos estáticos do frontend
// Quando você rodar 'npm run build', o Vite cria a pasta 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Rota da API
app.get('/companies', async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "Data é obrigatória (formato YYYY-MM-DD)" });
    }

    console.log(`[BACKEND] Buscando empresas para: ${date}`);

    try {
        // O Backend faz a requisição "Server-to-Server", onde não existe bloqueio de CORS
        const response = await fetch(`${BASE_URL}/companies?opened_at=${date}`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[BACKEND] Erro na API CNJPA: ${response.status}`, errorText);
            
            // Tratamento especial para 404 (nenhum resultado) para não parecer erro critico
            if (response.status === 404) {
                return res.json([]);
            }

            return res.status(response.status).json({ 
                error: `Erro na API externa: ${response.status}`, 
                details: errorText 
            });
        }

        const data = await response.json();
        
        // Retorna os dados puros para o frontend tratar
        res.json(data);

    } catch (error) {
        console.error("[BACKEND] Erro interno:", error);
        res.status(500).json({ error: "Erro interno no servidor ao buscar dados." });
    }
});

// Qualquer rota que não seja /companies retorna o index.html (Suporte para SPA/React Router)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
