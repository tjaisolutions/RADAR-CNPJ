import { EnrichedCompany, SearchQuery } from '../types';

const getBackendUrl = () => {
  if (!window.location.hostname.includes('localhost')) {
      return ""; 
  }
  return "http://localhost:3000";
};

const BACKEND_URL = getBackendUrl();

export const checkApiStatus = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`);
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
};

// Nova função preparada para Streaming
export const prospectLeads = async (
    query: SearchQuery, 
    onLeadFound: (lead: EnrichedCompany) => void
): Promise<void> => {
    
  console.log(`[API] Stream conectando em: ${BACKEND_URL || '/api/prospect'}`);
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/prospect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(response.statusText || "Erro ao conectar ao servidor.");
    }

    if (!response.body) {
        throw new Error("O servidor não retornou dados legíveis (ReadableStream).");
    }

    // Leitor de Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // Decodifica o pedaço (chunk) recebido
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Processa linhas completas (cada linha é um JSON)
        const lines = buffer.split("\n");
        
        // A última parte pode estar incompleta, guarda no buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const data = JSON.parse(line);
                    
                    if (data.error) {
                        console.error("Erro vindo do stream:", data.error);
                        // Não lançamos erro aqui para não parar os outros leads que podem ter vindo
                    } else if (data.info) {
                        console.log("Info:", data.info);
                    } else {
                        // É um lead válido
                        onLeadFound(data as EnrichedCompany);
                    }
                } catch (e) {
                    console.warn("Erro ao fazer parse de linha JSON:", line);
                }
            }
        }
    }

  } catch (error: any) {
    console.error("[API] Falha no Stream:", error);
    throw error;
  }
};
