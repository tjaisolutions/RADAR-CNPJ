export interface EnrichedCompany {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  nicho: string;
  status: 'Ativa' | 'Baixada' | 'Inapta';
  data_abertura: string;
  capital_social: string;
  porte: string;
  socios: Array<{
    nome: string;
    qualificacao: string;
  }>;
  endereco: {
    logradouro: string;
    numero: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  contato: {
    email: string | null;
    telefone: string | null;
    site?: string;
  };
  cnae?: string;
  score_enrichment: number; // 0 a 100 indicando qualidade dos dados
  origin?: string;
}

export interface SearchQuery {
  niche: string;
  location: string; // Usado para cidade ou UF dependendo do tipo
  region_type: 'cidade' | 'estado' | 'regiao';
  selected_uf?: string;
  selected_region?: string;
}

export interface SearchHistoryItem {
  id: string;
  query: SearchQuery;
  timestamp: number;
  resultCount: number;
  results: EnrichedCompany[];
}

export interface User {
    id: string;
    username: string;
    password: string; // In a real app, never store plain text passwords
    role: 'admin' | 'user';
    createdAt: number;
}
