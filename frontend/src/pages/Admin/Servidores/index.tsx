import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { servidoresService } from '@/services/servidores.service'
import type { Servidor } from '@/types'
import { Plus, Upload, Search, UserCheck, UserX, Loader2 } from 'lucide-react'

export default function Servidores() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', matricula: '', cargo: '', lotacao: '', email: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<{ total: number; validos: number; invalidos: number } | null>(null)

  const { data: servidores = [], isLoading } = useQuery({
    queryKey: ['servidores'],
    queryFn: () => servidoresService.listar(),
  })

  const criar = useMutation({
    mutationFn: servidoresService.criar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
      setShowForm(false)
      setForm({ nome: '', matricula: '', cargo: '', lotacao: '', email: '' })
    },
  })

  const alterarStatus = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => servidoresService.alterarStatus(id, ativo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servidores'] }),
  })

  const importar = useMutation({
    mutationFn: (file: File) => servidoresService.importar(file),
    onSuccess: (data) => {
      setUploadResult(data)
      setUploadFile(null)
      queryClient.invalidateQueries({ queryKey: ['servidores'] })
    },
  })

  const filtered = servidores.filter((s: Servidor) =>
    s.nome.toLowerCase().includes(search.toLowerCase()) ||
    s.matricula.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Servidores</h1>
          <p className="text-gray-500 mt-1">{servidores.length} servidores cadastrados</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors">
            <Upload size={16} />
            Importar XLSX
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Novo Servidor
          </button>
        </div>
      </div>

      {uploadFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">Arquivo selecionado: {uploadFile.name}</p>
            <p className="text-xs text-blue-600 mt-0.5">Clique em "Importar" para processar</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setUploadFile(null)} className="px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg text-sm">
              Cancelar
            </button>
            <button
              onClick={() => importar.mutate(uploadFile)}
              disabled={importar.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              {importar.isPending && <Loader2 size={14} className="animate-spin" />}
              Importar
            </button>
          </div>
        </div>
      )}

      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="font-medium text-green-800">Importação concluída!</p>
          <p className="text-sm text-green-700 mt-1">
            Total: {uploadResult.total} | Importados: {uploadResult.validos} | Com erro: {uploadResult.invalidos}
          </p>
          <button onClick={() => setUploadResult(null)} className="text-xs text-green-600 mt-2 underline">
            Fechar
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou matrícula..."
          className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Matrícula</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden md:table-cell">Cargo</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden lg:table-cell">Lotação</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s: Servidor) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.nome}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{s.matricula}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{s.cargo || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{s.lotacao || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => alterarStatus.mutate({ id: s.id, ativo: !s.ativo })}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title={s.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {s.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum servidor encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Novo Servidor</h3>
            <div className="space-y-3">
              {[
                { field: 'nome', label: 'Nome *', placeholder: 'Nome completo' },
                { field: 'matricula', label: 'Matrícula *', placeholder: '000000' },
                { field: 'cargo', label: 'Cargo', placeholder: 'Cargo' },
                { field: 'lotacao', label: 'Lotação', placeholder: 'Secretaria / Setor' },
                { field: 'email', label: 'E-mail', placeholder: 'servidor@municipio.gov.br' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={() => criar.mutate(form)}
                disabled={criar.isPending || !form.nome || !form.matricula}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {criar.isPending && <Loader2 size={14} className="animate-spin" />}
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
