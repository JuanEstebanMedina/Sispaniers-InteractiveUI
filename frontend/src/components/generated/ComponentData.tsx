import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type DataRow = Record<string, unknown>
export type Datasets = Record<string, DataRow[]>

const DatasetsContext = createContext<Datasets>({})

/**
 * The rows the generated charts draw.
 *
 * A chart node names a `dataKey` and nothing else — it never carries its own
 * rows. That keeps the agent's tree about structure and leaves the data to one
 * place, which is the seam the real backend plugs into later without touching
 * a single part.
 */
export function ComponentDataProvider({
  datasets,
  children,
}: {
  datasets: Datasets
  children: ReactNode
}) {
  // Memoised on the object itself: a fresh literal from the caller would give
  // every consumer a new context value on every render.
  const value = useMemo(() => datasets, [datasets])
  return <DatasetsContext.Provider value={value}>{children}</DatasetsContext.Provider>
}

/**
 * Rows for a key, or undefined when the agent named one that does not exist.
 * The charts pass that straight to `ChartFrame`, which already renders an empty
 * state — an invented key degrades to "no data", never to a crash.
 */
export function useDataset(key: string | undefined): DataRow[] | undefined {
  const datasets = useContext(DatasetsContext)
  return key ? datasets[key] : undefined
}
