import { GoogleGenAI, Type } from "@google/genai";
import { Company, AnalysisResult } from "../types";

// Note: In a real app, never expose keys on the client. This is for demo purposes as requested.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const analyzeLead = async (company: Company): Promise<AnalysisResult> => {
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }

  const model = "gemini-2.5-flash";

  const prompt = `
    Você é um especialista em vendas B2B e prospecção de empresas no Brasil.
    Analise a seguinte empresa recém-aberta:
    
    Nome: ${company.razaoSocial}
    CNAE (Atividade): ${company.cnaePrincipal} - ${company.cnaeDescricao}
    Localização: ${company.municipio}, ${company.uf}
    Capital Social: R$ ${company.capitalSocial}

    Gere um objeto JSON com:
    1. "strategy": Uma estratégia curta de 1 parágrafo sobre como vender serviços para este tipo de negócio.
    2. "emailDraft": Um esboço de e-mail frio curto e profissional oferecendo serviços genéricos de consultoria ou software.
    3. "potentialPainPoints": Uma lista de 3 prováveis dores/problemas que essa empresa enfrenta no início.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strategy: { type: Type.STRING },
            emailDraft: { type: Type.STRING },
            potentialPainPoints: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback if API fails or quota exceeded
    return {
      strategy: "Erro ao gerar estratégia com IA. Verifique sua chave de API.",
      emailDraft: "Erro ao gerar email.",
      potentialPainPoints: ["Não foi possível analisar."]
    };
  }
};