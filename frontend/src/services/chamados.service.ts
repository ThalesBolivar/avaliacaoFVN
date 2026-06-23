import api from './api'

export type ChamadoTipo = 'CARGO' | 'LOTACAO' | 'OUTRO'
export type ChamadoStatus = 'ABERTO' | 'RESOLVIDO' | 'REJEITADO'

export interface Chamado {
  id: number
  municipio_id: number
  usuario_id: number
  tipo: ChamadoTipo
  valor_solicitado: string
  descricao: string | null
  status: ChamadoStatus
  lote_importacao_id: number | null
  criado_em: string
  resolvido_em: string | null
}

export interface ChamadoCreatePayload {
  tipo: ChamadoTipo
  valor_solicitado: string
  descricao?: string
  lote_importacao_id?: number
}

export const chamadosService = {
  async criar(payload: ChamadoCreatePayload): Promise<Chamado> {
    const response = await api.post<Chamado>('/chamados', payload)
    return response.data
  },

  async listar(status?: ChamadoStatus, municipio_id?: number): Promise<Chamado[]> {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (municipio_id) params.set('municipio_id', String(municipio_id))
    const query = params.toString()
    const response = await api.get<Chamado[]>(`/chamados${query ? `?${query}` : ''}`)
    return response.data
  },
}
