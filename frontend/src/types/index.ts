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
  cargo_id?: number
  lotacao_id?: number
  lotacao?: LotacaoEmbed
  grau_instrucao?: string
  data_admissao?: string
  email?: string
  ativo: boolean
  criado_em: string
}

export interface VincularServidorPayload {
  municipio_id: number
}

// ── Lotação ──────────────────────────────────────────────────

export interface Lotacao {
  id: number
  municipio_id: number
  nome: string
  descricao?: string
  ordem: number
  ativo: boolean
  criado_em: string
}

export interface LotacaoEmbed {
  id: number
  nome: string
}

export interface LotacaoPayload {
  nome: string
  descricao?: string
  ordem?: number
  ativo?: boolean
}

// ── Nível de Cargo ───────────────────────────────────────────

export interface NivelCargoItem {
  id: number
  nome: string
  label: string
  descricao?: string
  ordem: number
  ativo: boolean
  criado_em: string
}

// ── Cargo ────────────────────────────────────────────────────

export interface NivelCargoEmbed {
  id: number
  nome: string
  label: string
}

export interface Cargo {
  id: number
  municipio_id: number
  nome: string
  nivel_id: number
  nivel: NivelCargoEmbed
  modelo_avaliacao_id?: number
  pontuacao_maxima: number
  pontos_min_estagio?: number
  pontos_min_progressao?: number
  ativo: boolean
}

export interface PesoQuestao {
  numero_pergunta: number
  peso: number
}

export interface CargoDetalhe extends Cargo {
  pesos: PesoQuestao[]
}

export interface CargoPayload {
  municipio_id?: number
  nome: string
  nivel_id: number
  modelo_avaliacao_id?: number | null
  pontuacao_maxima: number
  pontos_min_estagio?: number | null
  pontos_min_progressao?: number | null
  ativo: boolean
  pesos?: PesoQuestao[]
}

export interface ServidorFicha extends Servidor {
  cargo_catalogo?: CargoDetalhe
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

export interface FuncaoVinculada {
  id: number
  funcao_usuario_id: number
  nome: string
  perfil_base: string
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
  funcao_ids: number[]
  funcoes_vinculadas?: FuncaoVinculada[]
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

// ── Dashboard Funcoes Progresso ───────────────────────────────

export interface MembroSubcomissao {
  servidor_id: number
  nome: string
  cargo?: string
  matricula: string
  lotacao?: string
  papel: string
}

export type StatusGeralFuncao = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO'

export interface FuncaoProgresso {
  id: number | 'autoavaliacao'
  nome: string
  perfil_base: string
  total_servidores: number
  realizadas: number
  pendentes: number
  em_andamento: number
  percentual_conclusao: number
  status_geral: StatusGeralFuncao
  membros: MembroSubcomissao[]
}

export interface PeriodoDisponivel {
  id: number
  nome: string
  status: string
}

export interface DashboardFuncoesProgresso {
  periodo_id: number | null
  periodo_nome: string | null
  funcoes: FuncaoProgresso[]
  periodos_disponiveis: PeriodoDisponivel[]
}

// ── Funções de Usuário ───────────────────────────────────────

export interface UsuarioCompartilhadoInfo {
  id: number
  email: string
  ativo: boolean
}

export interface FuncaoUsuario {
  id: number
  municipio_id: number
  nome: string
  perfil_base?: 'ADMINISTRADOR' | 'CHEFIA' | 'SUBCOMISSAO'
  ativo: boolean
  criado_em: string
  /** Preenchido apenas para funções SUBCOMISSAO — usuário único compartilhado. */
  usuario_compartilhado?: UsuarioCompartilhadoInfo
  /** Retornado somente na criação de uma função SUBCOMISSAO. */
  senha_gerada?: string
}
