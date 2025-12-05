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
  source?: 'simulation' | 'manual' | 'api';
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
  DISCARDED = 'Descartado'
}

export interface AnalysisResult {
  strategy: string;
  emailDraft: string;
  potentialPainPoints: string[];
}

export type DataSourceMode = 'simulation' | 'manual' | 'live_api';

export interface AppConfig {
  mode: DataSourceMode;
  refreshInterval: number; // seconds
  apiKey: string;
}