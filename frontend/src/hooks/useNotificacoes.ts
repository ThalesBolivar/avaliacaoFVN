import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Notificacao } from '@/types'

export function useNotificacoes() {
  const queryClient = useQueryClient()

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: async () => {
      const response = await api.get<Notificacao[]>('/notificacoes')
      return response.data
    },
    refetchInterval: 30000,
  })

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  const marcarLida = useMutation({
    mutationFn: (id: number) => api.patch(`/notificacoes/${id}/lida`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] }),
  })

  const marcarTodasLidas = useMutation({
    mutationFn: () => api.patch('/notificacoes/marcar-todas-lidas'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] }),
  })

  return { notificacoes, naoLidas, isLoading, marcarLida, marcarTodasLidas }
}
