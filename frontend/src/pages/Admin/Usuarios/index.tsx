import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/services/api'
import { municipiosService } from '@/services/municipios.service'
import { useAuthStore } from '@/store/auth.store'
import { Plus, UserX, UserCheck, Loader2 } from 'lucide-react'
import { PERFIL_LABELS } from '@/utils/formatters'
import type { Municipio, Servidor } from '@/types'

interface Usuario {
  id: number
  nome: string
  email: string
  municipio_id: number
  servidor_id?: number | null
  perfil: string
  ativo: boolean
  criado_em: string
}

type Perfil = 'CHEFIA' | 'SUBCOMISSAO' | 'SERVIDOR'

export default function Usuarios() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.perfil === 'SUPER_ADMIN'
  const [showForm, setShowForm] = useState(false)
  const [selectedMunicipioId, setSelectedMunicipioId] = useState<string>('')
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'SERVIDOR' as Perfil,
    municipio_id: '',
    servidor_id: '',
  })
  const [error, setError] = useState('')

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios', selectedMunicipioId],
    queryFn: async () => {
      const query = isSuperAdmin && selectedMunicipioId ? `?municipio_id=${selectedMunicipioId}` : ''
      return (await api.get(`/usuarios${query}`)).data
    },
  })

  const { data: municipios = [] } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin-select'],
    queryFn: municipiosService.listarAdmin,
    enabled: isSuperAdmin,
  })

  const { data: servidores = [] } = useQuery<Servidor[]>({
    queryKey: ['servidores-usuarios-vinculo'],
    queryFn: async () => (await api.get('/servidores?ativo=true')).data,
    enabled: !isSuperAdmin,
  })

  const criar = useMutation({
    mutationFn: (data: object) => api.post('/usuarios', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      setShowForm(false)
      setForm({
        nome: '',
        email: '',
        senha: '',
        perfil: 'SERVIDOR',
        municipio_id: '',
        servidor_id: '',
      })
      setError('')
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail

        if (Array.isArray(detail) && detail[0]?.msg) {
          setError(detail[0].msg)
          return
        }

        if (typeof detail === 'string') {
          setError(detail)
          return
        }
      }

      setError('Não foi possível criar o usuário.')
    },
  })

  const alterarStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      api.patch(`/usuarios/${id}/status?ativo=${ativo}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const PERFIL_CORES: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-100 text-red-700',
    ADMINISTRADOR: 'bg-purple-100 text-purple-700',
    CHEFIA: 'bg-blue-100 text-blue-700',
    SUBCOMISSAO: 'bg-orange-100 text-orange-700',
    SERVIDOR: 'bg-gray-100 text-gray-600',
  }

  const emailValido = /\S+@\S+\.\S+/.test(form.email)

  const handleCreateUser = () => {
    if (!form.nome.trim()) {
      setError('Informe o nome do usuário.')
      return
    }

    if (!emailValido) {
      setError('Informe um e-mail válido.')
      return
    }

    if (form.senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (isSuperAdmin && !form.municipio_id) {
      setError('Selecione o município do usuário.')
      return
    }

    if ((form.perfil === 'SERVIDOR' || form.perfil === 'CHEFIA') && !isSuperAdmin && !form.servidor_id) {
      setError('Selecione o servidor vinculado para este usuário.')
      return
    }

    setError('')
    criar.mutate({
      ...form,
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      municipio_id: form.municipio_id ? Number(form.municipio_id) : undefined,
      servidor_id: form.servidor_id ? Number(form.servidor_id) : undefined,
    })
  }

  const getMunicipioNome = (municipioId: number) =>
    municipios.find((municipio) => municipio.id === municipioId)?.nome || `Município #${municipioId}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <p className="text-gray-500 mt-1">{usuarios.length} usuários cadastrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <select
              value={selectedMunicipioId}
              onChange={(e) => setSelectedMunicipioId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((municipio) => (
                <option key={municipio.id} value={municipio.id}>
                  {municipio.nome}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setError('')
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Novo Usuário
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">E-mail</th>
                {isSuperAdmin && (
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Município</th>
                )}
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Perfil</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u: Usuario) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.nome}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{u.email}</td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {getMunicipioNome(u.municipio_id)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERFIL_CORES[u.perfil] || 'bg-gray-100 text-gray-600'}`}>
                      {PERFIL_LABELS[u.perfil] || u.perfil}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => alterarStatus.mutate({ id: u.id, ativo: !u.ativo })}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title={u.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {u.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum usuário encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Novo Usuário</h3>
            <div className="space-y-3">
              {[
                { field: 'nome', label: 'Nome *', type: 'text', placeholder: 'Nome completo' },
                { field: 'email', label: 'E-mail *', type: 'email', placeholder: 'email@exemplo.com' },
                { field: 'senha', label: 'Senha *', type: 'password', placeholder: 'Mínimo 8 caracteres' },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Perfil *</label>
                <select
                  value={form.perfil}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil, servidor_id: '' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {(['CHEFIA', 'SUBCOMISSAO', 'SERVIDOR'] as Perfil[]).map((p) => (
                    <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              {!isSuperAdmin && (form.perfil === 'SERVIDOR' || form.perfil === 'CHEFIA') && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Servidor vinculado *</label>
                  <select
                    value={form.servidor_id}
                    onChange={(e) => setForm({ ...form, servidor_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Selecione o servidor</option>
                    {servidores.map((servidor) => (
                      <option key={servidor.id} value={servidor.id}>
                        {servidor.nome} - {servidor.matricula}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Município *</label>
                  <select
                    value={form.municipio_id}
                    onChange={(e) => setForm({ ...form, municipio_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Selecione o município</option>
                    {municipios.map((municipio) => (
                      <option key={municipio.id} value={municipio.id}>
                        {municipio.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => {
                  setShowForm(false)
                  setError('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={criar.isPending || !form.nome || !form.email || !form.senha}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
