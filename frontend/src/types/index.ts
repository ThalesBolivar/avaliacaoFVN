// ── Auth ──────────────────────────────────────────────────────

export type Perfil = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'CHEFIA' | 'SUBCOMISSAO' | 'SERVIDOR'

export interface AuthUser {
  id: number
  nome: string
  email: string
  perfil: Perfil
  municipio_id: number
  ativo: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  perfil: Perfil
  nome: string
  municipio_id: number
}

// ── Município ────────────────────────────────────────────────

export interface Municipio {
  id: number
  nome: string
  identificador: string
  estado: string
  cor_primaria?: string
  logo_url?: string
  ativo?: boolean
  criado_em?: string
}

// ── Servidor ─────────────────────────────────────────────────

export interface Servidor {
  id: number
  municipio_id: number
  usuario_id?: number
  chefia_servidor_id?: number
  nome: string
  cpf?: string
  matricula: string
  cargo?: string
  lotacao?: string
  data_admissao?: string
  email?: string
  telefone?: string
  ativo: boolean
  criado_em: string
}

// ── Questionários ────────────────────────────────────────────

export type StatusModelo = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO'
export type TipoResposta = 'MULTIPLA_ESCOLHA' | 'ESCALA_1_5' | 'SIM_NAO' | 'TEXTO_LIVRE'
export type LetraOpcao = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Categoria {
  id: number
  municipio_id: number
  nome: string
  descricao?: string
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface Opcao {
  id?: number
  letra_opcao: LetraOpcao
  texto_opcao: string
  pontuacao?: number
}

export interface Pergunta {
  id: number
  modelo_avaliacao_id: number
  categoria_id?: number
  criterio: string
  numero_pergunta: number
  texto_pergunta: string
  tipo_resposta: TipoResposta
  peso: number
  obrigatoria: boolean
  apenas_autoavaliacao: boolean
  apenas_superior: boolean
  apenas_subcomissao: boolean
  ativa: boolean
  opcoes: Opcao[]
}

export interface Modelo {
  id: number
  municipio_id: number
  nome: string
  descricao?: string
  versao: number
  status: StatusModelo
  para_autoavaliacao: boolean
  para_superior_imediato: boolean
  para_subcomissao: boolean
  pontuacao_maxima?: number
  publicado_em?: string
  criado_em: string
  total_perguntas: number
  perguntas?: Pergunta[]
}

// ── Períodos ─────────────────────────────────────────────────

export type StatusPeriodo = 'PLANEJADO' | 'ATIVO' | 'ENCERRADO'

export interface Periodo {
  id: number
  municipio_id: number
  nome: string
  data_inicio: string
  data_fim: string
  modelo_avaliacao_id?: number
  status: StatusPeriodo
  ativo: boolean
  criado_em: string
}

export interface Progresso {
  total_vinculos: number
  pendentes: number
  em_andamento: number
  finalizados: number
  percentual_concluido: number
}

// ── Avaliações ───────────────────────────────────────────────

export type TipoAvaliacao = 'AUTOAVALIACAO' | 'SUPERIOR_IMEDIATO' | 'SUBCOMISSAO'
export type StatusFormulario = 'PENDENTE' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA'

export interface FormularioResumo {
  id: number
  tipo_avaliacao: TipoAvaliacao
  status: StatusFormulario
  servidor_avaliado_id: number
  nome_servidor?: string
  pontuacao_total?: number
  iniciado_em?: string
  finalizado_em?: string
  criado_em: string
}

export interface Resposta {
  id: number
  pergunta_avaliacao_id: number
  opcao_selecionada?: string
  resposta_numerica?: number
  resposta_texto?: string
  pontuacao_obtida?: number
}

export interface PerguntaFormulario {
  id: number
  criterio: string
  numero_pergunta: number
  texto_pergunta: string
  tipo_resposta: TipoResposta
  peso: number
  obrigatoria: boolean
  opcoes: Opcao[]
}

export interface FormularioDetalhado extends FormularioResumo {
  observacoes?: string
  sugestoes_melhoria?: string
  uso_alcool_drogas?: boolean
  perguntas: PerguntaFormulario[]
  respostas: Resposta[]
}

// ── Notificações ─────────────────────────────────────────────

export interface Notificacao {
  id: number
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  lida_em?: string
  dados_extras?: Record<string, unknown>
  criado_em: string
}

// ── Dashboard ────────────────────────────────────────────────

export interface DashboardAdmin {
  escopo?: 'municipio' | 'global'
  municipio_id: number | null
  total_municipios?: number | null
  total_servidores: number
  modelos_publicados: number
  total_periodos: number
  total_periodos_ativos?: number
  periodo_ativo?: {
    id: number
    nome: string
    data_inicio: string
    data_fim: string
  }
  avaliacoes: {
    total: number
    pendentes: number
    em_andamento: number
    finalizadas: number
  }
  percentual_concluido: number
}

export interface DashboardServidor {
  total_avaliacoes: number
  pendentes: number
  finalizadas: number
}
