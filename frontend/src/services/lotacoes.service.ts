import api from './api'
import type { Lotacao, LotacaoPayload } from '@/types'

export const lotacoesService = {
  listar: (municipio_id?: number): Promise<Lotacao[]> =>
    api.get('/lotacoes', { params: municipio_id ? { municipio_id } : undefined }).then(r => r.data),

  criar: (data: LotacaoPayload): Promise<Lotacao> =>
    api.post('/lotacoes', data).then(r => r.data),

  atualizar: (id: number, data: Partial<LotacaoPayload>): Promise<Lotacao> =>
    api.put(`/lotacoes/${id}`, data).then(r => r.data),

  excluir: (id: number): Promise<void> =>
    api.delete(`/lotacoes/${id}`).then(r => r.data),
}
