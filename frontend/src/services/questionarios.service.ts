import api from './api'
import type { Modelo, Pergunta, Opcao, Categoria } from '@/types'

export interface PerguntaPayload {
  criterio: string
  numero_pergunta: number
  texto_pergunta: string
  tipo_resposta: Pergunta['tipo_resposta']
  peso: number
  obrigatoria: boolean
  categoria_id?: number
  apenas_autoavaliacao: boolean
  apenas_superior: boolean
  apenas_subcomissao: boolean
  opcoes: Array<{
    letra_opcao: Opcao['letra_opcao']
    texto_opcao: string
    pontuacao?: number
  }>
}

export interface ModeloPayload {
  nome: string
  descricao?: string
  para_autoavaliacao: boolean
  para_superior_imediato: boolean
  para_subcomissao: boolean
  perguntas: PerguntaPayload[]
}

export interface QuestionarioPreview {
  id: number
  nome: string
  descricao?: string
  status: string
  total_perguntas: number
  perguntas: Array<{
    numero: number
    criterio: string
    texto: string
    tipo: string
    peso: number
    obrigatoria: boolean
    categoria: string | null
    opcoes: Array<{
      letra: string
      texto: string
      pontuacao: number | null
    }>
  }>
}

export const questionariosService = {
  // Modelos
  async listarModelos(): Promise<Modelo[]> {
    const response = await api.get<Modelo[]>('/admin/questionarios')
    return response.data
  },

  async criarModelo(data: ModeloPayload): Promise<Modelo> {
    const response = await api.post<Modelo>('/admin/questionarios', data)
    return response.data
  },

  async detalharModelo(id: number): Promise<Modelo> {
    const response = await api.get<Modelo>(`/admin/questionarios/${id}`)
    return response.data
  },

  async atualizarModelo(id: number, data: ModeloPayload): Promise<Modelo> {
    const response = await api.put<Modelo>(`/admin/questionarios/${id}`, data)
    return response.data
  },

  async publicarModelo(id: number): Promise<Modelo> {
    const response = await api.post<Modelo>(`/admin/questionarios/${id}/publicar`)
    return response.data
  },

  async clonarModelo(id: number): Promise<Modelo> {
    const response = await api.post<Modelo>(`/admin/questionarios/${id}/clonar`)
    return response.data
  },

  async previewModelo(id: number): Promise<QuestionarioPreview> {
    const response = await api.get<QuestionarioPreview>(`/admin/questionarios/${id}/preview`)
    return response.data
  },

  async deletarModelo(id: number): Promise<void> {
    await api.delete(`/admin/questionarios/${id}`)
  },

  // Perguntas
  async listarPerguntas(modeloId: number): Promise<Pergunta[]> {
    const response = await api.get<Pergunta[]>(`/admin/questionarios/${modeloId}/perguntas`)
    return response.data
  },

  async adicionarPergunta(modeloId: number, data: Partial<Pergunta>): Promise<Pergunta> {
    const response = await api.post<Pergunta>(`/admin/questionarios/${modeloId}/perguntas`, data)
    return response.data
  },

  async atualizarPergunta(modeloId: number, perguntaId: number, data: Partial<Pergunta>): Promise<Pergunta> {
    const response = await api.put<Pergunta>(`/admin/questionarios/${modeloId}/perguntas/${perguntaId}`, data)
    return response.data
  },

  async deletarPergunta(modeloId: number, perguntaId: number): Promise<void> {
    await api.delete(`/admin/questionarios/${modeloId}/perguntas/${perguntaId}`)
  },

  async reordenarPerguntas(modeloId: number, items: { id: number; numero_pergunta: number }[]): Promise<void> {
    await api.patch(`/admin/questionarios/${modeloId}/perguntas/reordenar`, items)
  },

  // Opções
  async adicionarOpcao(modeloId: number, perguntaId: number, data: Partial<Opcao>): Promise<Opcao> {
    const response = await api.post<Opcao>(`/admin/questionarios/${modeloId}/perguntas/${perguntaId}/opcoes`, data)
    return response.data
  },

  async atualizarOpcao(modeloId: number, perguntaId: number, opcaoId: number, data: Partial<Opcao>): Promise<Opcao> {
    const response = await api.put<Opcao>(`/admin/questionarios/${modeloId}/perguntas/${perguntaId}/opcoes/${opcaoId}`, data)
    return response.data
  },

  // Categorias
  async listarCategorias(): Promise<Categoria[]> {
    const response = await api.get<Categoria[]>('/admin/categorias')
    return response.data
  },

  async criarCategoria(data: Partial<Categoria>): Promise<Categoria> {
    const response = await api.post<Categoria>('/admin/categorias', data)
    return response.data
  },
}
