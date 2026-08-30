import { describe, expect, test } from 'vitest'

import { type GridItem, moveItem, pack } from '@/lib/grid'

const COLS = 4

function sized(id: string, w: number, h: number): GridItem {
  return { id, col: 0, row: 0, w, h }
}

function sequenceOf(items: GridItem[]): string[] {
  return items.map((item) => item.id)
}

/**
 * A column next to a wide banner leaves a hole at (1,0) that the tile behind
 * them falls into, so the tile renders ABOVE the banner it comes after. Reading
 * order and sequence order disagree from here on — which is the whole point.
 */
function packedWithAHole(): GridItem[] {
  return pack([sized('column', 1, 5), sized('wide', 4, 2), sized('tile', 1, 1)], COLS)
}

describe('moveItem', () => {
  test('the fixture really does pack the tile into an earlier hole', () => {
    const settled = packedWithAHole()

    expect(settled).toEqual([
      { id: 'column', col: 0, row: 0, w: 1, h: 5 },
      { id: 'wide', col: 0, row: 5, w: 4, h: 2 },
      { id: 'tile', col: 1, row: 0, w: 1, h: 1 },
    ])
  })

  test('dropping a widget back on its own cell leaves the sequence alone', () => {
    const settled = packedWithAHole()
    const wide = settled.find((item) => item.id === 'wide')

    if (!wide) throw new Error('fixture lost the wide widget')

    expect(sequenceOf(moveItem(settled, 'wide', wide.col, wide.row, COLS))).toEqual([
      'column',
      'wide',
      'tile',
    ])
  })

  test('dropping a widget on another cell still reorders', () => {
    const settled = packedWithAHole()

    expect(sequenceOf(moveItem(settled, 'tile', 0, 0, COLS))).toEqual(['tile', 'column', 'wide'])
  })
})
