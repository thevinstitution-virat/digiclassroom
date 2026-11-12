'use client'

// Which written-work space the screen is in (13 Nov 2026). InkBuddy is open to every learner, school students too; their InkBuddy questions live
// in the practice space, not in their school. An InkBuddy screen calls useHwSpace('practice'), and every API request it makes carries
// `x-hw-space: practice` (provider.tsx); the server honours it only for someone with an InkBuddy trial (access/actor.ts).

import { useEffect, useState } from 'react'

export type HwSpace = 'practice'

let current: HwSpace | null = null

/** Headers for the next API request. */
export const hwSpaceHeaders = (): Record<string, string> => (current ? { 'x-hw-space': current } : {})

/**
 * Marks the screen as being in `space` for as long as it is shown (null = nothing to mark). Set during the first render, so the screen's
 * first requests already carry it; cleared when the screen goes.
 */
export function useHwSpace(space: HwSpace | null): void {
  useState(() => { if (space) current = space })
  useEffect(() => {
    if (!space) return
    current = space
    return () => { if (current === space) current = null }
  }, [space])
}
