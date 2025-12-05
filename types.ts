
export interface Company {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  dataAbertura: string; // ISO String
  cnaePrincipal: string;
  cnaeDescricao: string;
  naturezaJuridica: string;
  uf: string;
  municipio: string;
  email: string | null;
  telefone: string | null;
  capitalSocial: number;
  status: 'active' | 'pending';
  // UI helper props
  isContacted?: boolean;
  notes?: string;
  source?: 'simulation' | 'manual' | 'cnpja' | 'api' | 'infosimples' | 'cnpj_ws_comercial';
}

export interface FilterState {
  uf: string;
  cnae: string;
  onlyWithContact: boolean;
}

export enum LeadStatus {
  NEW = 'Novo',
  CONTACTED = 'Contatado',
  QUALIFIED = 'Qualificado',
  LOST = 'Perdido'
}

export interface AnalysisResult {
  strategy: string;
  emailDraft: string;
  potentialPainPoints: string[];
}

export interface AppConfig {
  mode: 'simulation' | 'manual' | 'cnpja';
  refreshInterval: number;
  apiKey: string;
}
