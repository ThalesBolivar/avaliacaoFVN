import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionariosService } from '@/services/questionarios.service'
import type { Categoria } from '@/types'
import { Tags, Plus, Edit, Trash2, Loader2, ChevronDown, ChevronUp, X, Save, Search } from 'lucide-react'

interface FormState {
  id?: number
  nome: string
  descricao: string
  ordem: number
}

const EMPTY_FORM: FormState = { nome: '', descricao: '', ordem: 0 }

export default function CategoriasManager() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [filtro, setFiltro] = useState('')

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: questionariosService.listarCategorias,
  })

  const categoriasFiltradas = categorias.filter((cat) =>
    cat.nome.toLowerCase().includes(filtro.trim().toLowerCase())
  )

  function resetForm() {
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const salvar = useMutation({
    mutationFn: (data: FormState) => {
      const payload = {
        nome: data.nome.trim(),
        descricao: data.descricao.trim() || undefined,
        ordem: Number(data.ordem) || 0,
      }
      return data.id
        ? questionariosService.atualizarCategoria(data.id, payload)
        : questionariosService.criarCategoria(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] })
      resetForm()
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao salvar a categoria.')
    },
  })

  const deletar = useMutation({
    mutationFn: (id: number) => questionariosService.deletarCategoria(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias'] }),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erro ao remover a categoria.')
    },
  })

  function abrirNova() {
    setForm(EMPTY_FORM)
    setShowForm(true)
    setExpanded(true)
  }

  function abrirEdicao(cat: Categoria) {
    setForm({ id: cat.id, nome: cat.nome, descricao: cat.descricao || '', ordem: cat.ordem })
    setShowForm(true)
    setExpanded(true)
  }

  function handleSubmit() {
    if (!form.nome.trim()) {
      alert('Informe o nome da categoria.')
      return
    }
    const mensagem = form.id
      ? `Confirmar as alterações na categoria "${form.nome.trim()}"?`
      : `Confirmar a criação da categoria "${form.nome.trim()}"?`
    if (!confirm(mensagem)) return
    salvar.mutate(form)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between p-5">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 text-left">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600">
            <Tags size={18} />
          </span>
          <span>
            <span className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">Categorias de Perguntas</h2>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{categorias.length}</span>
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Defina as categorias antes de montar as perguntas do questionário</p>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={abrirNova} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} />
            Nova Categoria
          </button>
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4">
          {showForm && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{form.id ? 'Editar categoria' : 'Nova categoria'}</h3>
                <button type="button" onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
                  <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Conduta Funcional" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
                  <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Opcional" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500 mb-1 block">Ordem</label>
                  <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={resetForm} className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="button" onClick={handleSubmit} disabled={salvar.isPending} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-blue-600" size={22} /></div>
          ) : categorias.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma categoria cadastrada. Crie a primeira para organizar as perguntas.</p>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar categoria..." className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {filtro && (
                  <button type="button" onClick={() => setFiltro('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
                )}
              </div>

              {categoriasFiltradas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma categoria encontrada para "{filtro}".</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                  {categoriasFiltradas.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2.5 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">{cat.ordem}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{cat.nome}</p>
                        {cat.descricao && (<p className="text-xs text-gray-400 truncate">{cat.descricao}</p>)}
                      </div>
                      <button type="button" onClick={() => abrirEdicao(cat)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors shrink-0" title="Editar"><Edit size={15} /></button>
                      <button type="button" onClick={() => { if (confirm(`Remover a categoria "${cat.nome}"?`)) deletar.mutate(cat.id) }} disabled={deletar.isPending} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors shrink-0" title="Remover"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
