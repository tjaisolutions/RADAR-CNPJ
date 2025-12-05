import { Company } from '../types';

// Dados de empresas realistas para testar a capacidade de análise da IA em diferentes setores
const REALISTIC_SCENARIOS = [
  {
    razaoSocial: "SABOR DO TRIGO PANIFICADORA E CONFEITARIA LTDA",
    nomeFantasia: "PADARIA SABOR DO TRIGO",
    cnaePrincipal: "10.91-1-01",
    cnaeDescricao: "Fabricação de produtos de panificação industrial",
    municipio: "São Paulo",
    uf: "SP",
    capitalSocial: 120000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "INOVATECH SOLUCOES DIGITAIS S.A.",
    nomeFantasia: "INOVATECH",
    cnaePrincipal: "62.01-5-01",
    cnaeDescricao: "Desenvolvimento de programas de computador sob encomenda",
    municipio: "Florianópolis",
    uf: "SC",
    capitalSocial: 500000,
    natureza: "205-4 - Sociedade Anônima Fechada"
  },
  {
    razaoSocial: "CONSTRUTORA ALMEIDA & SILVA EMPREENDIMENTOS",
    nomeFantasia: "ALMEIDA ENGENHARIA",
    cnaePrincipal: "41.20-4-00",
    cnaeDescricao: "Construção de edifícios",
    municipio: "Belo Horizonte",
    uf: "MG",
    capitalSocial: 1500000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "CLINICA VETERINARIA AMIGO FIEL LTDA",
    nomeFantasia: "VET AMIGO FIEL",
    cnaePrincipal: "75.00-1-00",
    cnaeDescricao: "Atividades veterinárias",
    municipio: "Curitiba",
    uf: "PR",
    capitalSocial: 80000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "AGROPECUARIA FAZENDA VERDE EIRELI",
    nomeFantasia: "AGRO VERDE",
    cnaePrincipal: "01.11-3-02",
    cnaeDescricao: "Cultivo de milho",
    municipio: "Goiânia",
    uf: "GO",
    capitalSocial: 3500000,
    natureza: "230-5 - Empresa Individual de Responsabilidade Limitada"
  },
  {
    razaoSocial: "DR. FERNANDO MEDEIROS ADVOCACIA",
    nomeFantasia: "MEDEIROS LAW",
    cnaePrincipal: "69.11-7-01",
    cnaeDescricao: "Serviços advocatícios",
    municipio: "Rio de Janeiro",
    uf: "RJ",
    capitalSocial: 30000,
    natureza: "223-2 - Sociedade Simples Pura"
  },
  {
    razaoSocial: "BELEZA E ESTILO SALAO DE BELEZA LTDA",
    nomeFantasia: "STUDIO GLAMOUR",
    cnaePrincipal: "96.02-5-01",
    cnaeDescricao: "Cabeleireiros, manicure e pedicure",
    municipio: "Salvador",
    uf: "BA",
    capitalSocial: 45000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "LOGISTICA RAPIDA EXPRESS TRANSPORTES",
    nomeFantasia: "RAPIDA EXPRESS",
    cnaePrincipal: "49.30-2-02",
    cnaeDescricao: "Transporte rodoviário de carga",
    municipio: "Campinas",
    uf: "SP",
    capitalSocial: 200000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "MERCADO E ACOUGUE DO BAIRRO LTDA",
    nomeFantasia: "MERCADINHO DO ZE",
    cnaePrincipal: "47.11-3-02",
    cnaeDescricao: "Comércio varejista de mercadorias em geral",
    municipio: "Recife",
    uf: "PE",
    capitalSocial: 60000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  },
  {
    razaoSocial: "CONSULTORIA FINANCEIRA ELITE",
    nomeFantasia: "ELITE FINANCAS",
    cnaePrincipal: "70.20-4-00",
    cnaeDescricao: "Atividades de consultoria em gestão empresarial",
    municipio: "Porto Alegre",
    uf: "RS",
    capitalSocial: 20000,
    natureza: "206-2 - Sociedade Empresária Limitada"
  }
];

const generateCNPJ = (): string => {
  const n = () => Math.floor(Math.random() * 9);
  return `${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}/0001-${n()}${n()}`;
};

export const generateMockCompany = (): Company => {
  // Seleciona um cenário aleatório
  const scenario = REALISTIC_SCENARIOS[Math.floor(Math.random() * REALISTIC_SCENARIOS.length)];
  
  // Adiciona variação para não ficar idêntico se aparecer repetido
  const randomId = Math.floor(Math.random() * 1000);
  const hasContact = Math.random() > 0.3; // 70% de chance de ter contato

  // Gera data de abertura recente (hoje ou ontem)
  const date = new Date();
  date.setHours(date.getHours() - Math.floor(Math.random() * 48));

  return {
    id: Math.random().toString(36).substr(2, 9),
    cnpj: generateCNPJ(),
    razaoSocial: scenario.razaoSocial,
    nomeFantasia: scenario.nomeFantasia,
    dataAbertura: date.toISOString(),
    cnaePrincipal: scenario.cnaePrincipal,
    cnaeDescricao: scenario.cnaeDescricao,
    naturezaJuridica: scenario.natureza,
    uf: scenario.uf,
    municipio: scenario.municipio,
    email: hasContact ? `contato@${scenario.nomeFantasia.toLowerCase().replace(/\s/g, '')}.com.br` : null,
    telefone: hasContact ? `(11) 9${Math.floor(Math.random() * 10000)}-${Math.floor(Math.random() * 10000)}` : null,
    capitalSocial: scenario.capitalSocial,
    status: 'active'
  };
};