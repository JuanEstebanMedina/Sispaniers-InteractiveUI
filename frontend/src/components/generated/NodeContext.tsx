import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { ComponentNode } from '@/schemas/component.schema'

const NodeCtx = createContext<ComponentNode | null>(null)

/**
 * Publishes the node a part is rendering.
 *
 * The parts pull what they care about instead of being handed it. That is what
 * keeps a four-level tree from threading props it does not use: a chart nested
 * inside two layouts reads its own `dataKey` without either layout knowing a
 * chart exists.
 */
export function NodeProvider({ node, children }: { node: ComponentNode; children: ReactNode }) {
  return <NodeCtx.Provider value={node}>{children}</NodeCtx.Provider>
}

export function useNode(): ComponentNode {
  const node = useContext(NodeCtx)
  if (!node) {
    throw new Error('A generated part was rendered outside its NodeProvider')
  }
  return node
}

/**
 * Typed reader over `props`.
 *
 * Every part reads through this, so the agent's `Record<string, unknown>` is
 * distrusted in exactly one place. A value of the wrong type, or off a closed
 * list, becomes the default here and never reaches the DOM.
 */
export interface PropReader {
  str(key: string, fallback?: string): string
  /** Empty string becomes undefined, so an absent prop is absent, not blank. */
  text(key: string): string | undefined
  num(key: string, fallback?: number): number
  bool(key: string, fallback?: boolean): boolean
  oneOf<T extends string>(key: string, allowed: readonly T[], fallback: T): T
  /** Maps an array prop, dropping every entry the mapper rejects. */
  list<T>(key: string, map: (item: Record<string, unknown>) => T | null): T[]
  action(fallback?: string): string
}

export function useProps(): PropReader {
  const node = useNode()

  return useMemo(() => {
    const raw = node.props

    const str = (key: string, fallback = '') =>
      typeof raw[key] === 'string' ? (raw[key] as string) : fallback

    return {
      str,
      text: (key) => str(key) || undefined,
      num: (key, fallback = 0) =>
        typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? (raw[key] as number) : fallback,
      bool: (key, fallback = false) =>
        typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback,
      oneOf: (key, allowed, fallback) =>
        typeof raw[key] === 'string' && (allowed as readonly string[]).includes(raw[key] as string)
          ? (raw[key] as never)
          : fallback,
      list: (key, map) => {
        const value = raw[key]
        if (!Array.isArray(value)) return []
        return value.flatMap((item) => {
          if (typeof item !== 'object' || item === null) return []
          const mapped = map(item as Record<string, unknown>)
          return mapped === null ? [] : [mapped]
        })
      },
      action: (fallback = 'navigate') =>
        typeof node.action === 'string' ? node.action : fallback,
    } as PropReader
  }, [node])
}
