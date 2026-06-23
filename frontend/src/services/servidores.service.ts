import api from './api'
import type { Servidor, ServidorFicha, VincularServidorPayload } from '@/types'

export interface ImportacaoErro {
  linha: number
  linha_id: number
  matricula: string | null
  nome: string | null
  mensagem: string
}

export interface ImportacaoResultado {
  lote_id: number
  total: number
  validos: number
  invalidos: number
  erros: ImportacaoErro[]
}

export const servidoresService = {
  async listar(ativo?: boolean, municipio_id?: number): Promise<Servidor[]> {
    const params = new URLSearchParams()
    if (typeof ativo === 'boolean') params.set('ativo', String(ativo))
    if (municipio_id) params.set('municipio_id', String(municipio_id))
    const query = params.toString()
    const response = await api.get<Servidor[]>(`/servidores${query ? `?${query}` : ''}`)
    return response.data
  },

  async detalhar(id: number): Promise<Servidor> {
    const response = await api.get<Servidor>(`/servidores/${id}`)
    return response.data
  },

  async criar(data: Partial<Servidor>): Promise<Servidor> {
    const response = await api.post<Servidor>('/servidores', data)
    return response.data
  },

  async atualizar(id: number, data: Partial<Servidor>): Promise<Servidor> {
    const response = await api.put<Servidor>(`/servidores/${id}`, data)
    return response.data
  },

  async vincularMunicipio(id: number, data: VincularServidorPayload): Promise<Servidor> {
    const response = await api.patch<Servidor>(`/servidores/${id}/municipio?municipio_id=${data.municipio_id}`)
    return response.data
  },

  async alterarStatus(id: number, ativo: boolean): Promise<void> {
    await api.patch(`/servidores/${id}/status?ativo=${ativo}`)
  },

  async ficha(id: number): Promise<ServidorFicha> {
    const response = await api.get<ServidorFicha>(`/servidores/${id}/ficha`)
    return response.data
  },

  async vincularFuncao(id: number, funcao_usuario_id: number): Promise<void> {
    await api.post(`/servidores/${id}/funcoes`, { funcao_usuario_id })
  },

  async listarFuncoes(id: number): Promise<{ id: number; funcao_usuario_id: number; nome: string; criado_em: string }[]> {
    const response = await api.get(`/servidores/${id}/funcoes`)
    return response.data
  },

  async desvincularFuncao(servidorId: number, vinculoId: number): Promise<void> {
    await api.delete(`/servidores/${servidorId}/funcoes/${vinculoId}`)
  },

  async importar(arquivo: File): Promise<ImportacaoResultado> {
    const form = new FormData()
    form.append('arquivo', arquivo)
    const response = await api.post<ImportacaoResultado>('/servidores/importar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async reprocessarImportacao(
    loteId: number,
    correcoes: { linha_id: number; cargo_id?: number; lotacao_id?: number }[],
  ): Promise<ImportacaoResultado> {
    const response = await api.post<ImportacaoResultado>(`/servidores/importar/${loteId}/reprocessar`, { correcoes })
    return response.data
  },
}
