import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Municipio } from '@/types'

interface MunicipioState {
  municipios: Municipio[]
  municipioSelecionado: Municipio | null
  setMunicipios: (municipios: Municipio[]) => void
  selecionarMunicipio: (municipio: Municipio) => void
}

export const useMunicipioStore = create<MunicipioState>()(
  persist(
    (set) => ({
      municipios: [],
      municipioSelecionado: null,
      setMunicipios: (municipios) => set({ municipios }),
      selecionarMunicipio: (municipio) => set({ municipioSelecionado: municipio }),
    }),
    {
      name: 'avaliacao-municipio',
      partialize: (state) => ({ municipioSelecionado: state.municipioSelecionado }),
    }
  )
)
