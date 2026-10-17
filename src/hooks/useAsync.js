import { useCallback, useEffect, useState } from 'react'
// Returns { data, loading, error, reload } for any promise-returning fn
export function useAsync(fn, deps = []) {
  const [s, setS] = useState({ data: null, loading: true, error: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)
  const reload = useCallback(() => {
    let live = true
    setS((x) => ({ ...x, loading: true, error: null }))
    run().then((data) => live && setS({ data, loading: false, error: null }))
      .catch((error) => live && setS({ data: null, loading: false, error }))
    return () => { live = false }
  }, [run])
  useEffect(() => reload(), [reload])
  return { ...s, reload }
}
