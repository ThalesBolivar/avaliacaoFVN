import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPinned, Pencil, Plus } from 'lucide-react'
import { municipiosService } from '@/services/municipios.service'
import { useAuthStore } from '@/store/auth.store'
import type { Municipio } from '@/types'

const EMPTY_FORM = {
  nome: '',
  identificador: '',
  estado: 'MG',
  cor_primaria: '#1a56db',
  logo_url: '',
  ativo: true,
}

export default function Municipios() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Municipio | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: municipios = [], isLoading } = useQuery<Municipio[]>({
    queryKey: ['municipios-admin'],
    queryFn: municipiosService.listarAdmin,
    enabled: user?.perfil === 'SUPER_ADMIN',
  })

  const totalAtivos = useMemo(
    () => municipios.filter((municipio) => municipio.ativo !== false).length,
    [municipios]
  )

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        identificador: form.identificador.trim().toLowerCase(),
        estado: form.estado.trim().toUpperCase(),
        cor_primaria: form.cor_primaria.trim() || '#1a56db',
        logo_url: form.logo_url.trim() || undefined,
        ativo: form.ativo,
      }

      if (editing) {
        return municipiosService.atualizar(editing.id, payload)
      }

      return municipiosService.criar(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipios-admin'] })
      queryClient.invalidateQueries({ queryKey: ['municipios'] })
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      setError('')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Não foi possível salvar o município.')
    },
  })

  if (user?.perfil !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  const openCreate = () => {
    setEditing(null)
    setError('')
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (municipio: Municipio) => {
    setEditing(municipio)
    setError('')
    setForm({
      nome: municipio.nome,
      identificador: municipio.identificador,
      estado: municipio.estado,
      cor_primaria: municipio.cor_primaria || '#1a56db',
      logo_url: municipio.logo_url || '',
      ativo: municipio.ativo !== false,
    })
    setShowForm(true)
  }

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      setError('Informe o nome do município.')
      return
    }

    if (!form.identificador.trim()) {
      setError('Informe o identificador do município.')
      return
    }

    if (form.estado.trim().length !== 2) {
      setError('Informe a UF com 2 letras.')
      return
    }

    setError('')
    salvar.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Municípios</h1>
          <p className="text-gray-500 mt-1">
            {municipios.length} municípios cadastrados, {totalAtivos} ativos
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} />
          Novo Município
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid gap-4">
          {municipios.map((municipio) => (
            <div key={municipio.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: municipio.cor_primaria || '#1a56db22' }}
                  >
                    <MapPinned size={20} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{municipio.nome}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          municipio.ativo !== false
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {municipio.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {municipio.identificador} • {municipio.estado}
                    </p>
                    {municipio.logo_url && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        Logo: {municipio.logo_url}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openEdit(municipio)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                  title="Editar município"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          ))}

          {municipios.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              Nenhum município cadastrado
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editing ? 'Editar Município' : 'Novo Município'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Identificador *</label>
                  <input
                    value={form.identificador}
                    onChange={(e) => setForm({ ...form, identificador: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={Boolean(editing)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">UF *</label>
                  <input
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    maxLength={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={Boolean(editing)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Cor primária</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.cor_primaria}
                      onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })}
                      className="h-10 w-12 rounded border border-gray-300 bg-white"
                    />
                    <input
                      value={form.cor_primaria}
                      onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    />
                    Município ativo
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Logo URL</label>
                <input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

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
                  setEditing(null)
                  setError('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={salvar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {salvar.isPending && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Salvar Alterações' : 'Criar Município'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
