import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Abre um formulário quando a URL contém ?novo=1 (atalhos do dashboard e da busca)
 * e remove o parâmetro em seguida.
 */
export function useOpenFromQuery(open: (params: URLSearchParams) => void, key = 'novo') {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    if (params.has(key)) {
      open(params)
      const next = new URLSearchParams(params)
      next.delete(key)
      next.delete('produto')
      setParams(next, { replace: true })
    }
  }, [params, key, open, setParams])
}
