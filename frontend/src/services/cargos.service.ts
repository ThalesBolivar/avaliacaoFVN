import api from './api'
import type { Cargo, CargoDetalhe, CargoPayload } from '@/types'

export const cargosService = {
  /**
   * Lista cargos. Por padrão traz apenas ativos (ativo=true) — usado nos selects
   * de cadastro de servidor. A tela de gestão chama com ativo=null para trazer todos.
   */
  async listar(municipio_id?: number, ativo: boolean | null = true): Promise<Cargo[]> {
    const params = new URLSearchParams()
    if (municipio_id) params.set('municipio_id', String(municipio_id))
    if (ativo !== null) params.set('ativo', String(ativo))
    const query = params.toString()
    const response = await api.get<Cargo[]>(`/cargos${query ? `?${query}` : ''}`)
    return response.data
  },

  async detalhar(id: number): Promise<CargoDetalhe> {
    const response = await api.get<CargoDetalhe>(`/cargos/${id}`)
    return response.data
  },

  async criar(data: CargoPayload): Promise<CargoDetalhe> {
    const response = await api.post<CargoDetalhe>('/cargos', data)
    return response.data
  },

  async atualizar(id: number, data: Partial<CargoPayload>): Promise<CargoDetalhe> {
    const response = await api.put<CargoDetalhe>(`/cargos/${id}`, data)
    return response.data
  },

  async excluir(id: number): Promise<{ message: string; desativado: boolean }> {
    const response = await api.delete<{ message: string; desativado: boolean }>(`/cargos/${id}`)
    return response.data
  },
}
