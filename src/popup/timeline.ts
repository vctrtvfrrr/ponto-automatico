import type { WorkDay } from '../page/readers.ts'
import { recognitionWindow, type Trigger } from '../triggers/plan.ts'

/**
 * What one line of the popup says about itself. `unreconciled` is the absence
 * of a claim: a Trigger that cannot be reconciled, or a Punch on a day that
 * planned no Trigger at all. `unverified` is the absence of evidence: the
 * Jornada was never read late enough to say how the Trigger ended.
 */
export type RowState =
  | 'fulfilled'
  | 'disabled'
  | 'next'
  | 'future'
  | 'awaiting'
  | 'failed'
  | 'unplanned'
  | 'unreconciled'
  | 'unverified'

export type TimelineRow = { at: number; state: RowState }

export type TimelineInput = {
  triggers: Trigger[]
  punches: number[]
  toleranceMinutes: number
  now: number
  observedAt?: number
  resumedAt?: number
}

export function punchInstants(workDay: WorkDay): number[] {
  return workDay.punches.map((time) => new Date(`${workDay.date}T${time}:00`).getTime())
}

export function buildTimeline({ triggers, punches, toleranceMinutes, now, observedAt, resumedAt }: TimelineInput): TimelineRow[] {
  const tolerance = toleranceMinutes * 60_000
  const claimed = new Set<number>()
  const rows: TimelineRow[] = []
  let upcoming = true

  for (const trigger of triggers) {
    const window = recognitionWindow(trigger)
    if (!window) {
      rows.push({ at: trigger.at, state: 'unreconciled' })
      continue
    }

    // The alarm runs late whenever the browser idles, so a successful Punch is
    // often born after the window ends — the Tolerance is where it lands.
    const claim = punches.findIndex((punch, index) => (
      !claimed.has(index) && punch >= window.start && punch <= trigger.at + tolerance
    ))
    if (claim !== -1) {
      claimed.add(claim)
      rows.push({ at: punches[claim]!, state: 'fulfilled' })
      continue
    }

    if (resumedAt !== undefined && trigger.at <= resumedAt) rows.push({ at: trigger.at, state: 'disabled' })
    else if (trigger.at >= now) {
      rows.push({ at: trigger.at, state: upcoming ? 'next' : 'future' })
      upcoming = false
    } else {
      // Saying a Trigger produced no Punch is a claim about the Jornada, and
      // only a reading taken past the moment in question can support it.
      const deadline = trigger.at + tolerance
      const expired = now > deadline
      const seen = observedAt !== undefined && (expired ? observedAt > deadline : observedAt >= trigger.at)
      rows.push({ at: trigger.at, state: !seen ? 'unverified' : expired ? 'failed' : 'awaiting' })
    }
  }

  // With no Trigger planned, no Punch is missing one: labelling every line would
  // tell the reader nothing.
  const orphan: RowState = triggers.length > 0 ? 'unplanned' : 'unreconciled'
  punches.forEach((punch, index) => {
    if (!claimed.has(index)) rows.push({ at: punch, state: orphan })
  })

  return rows.sort((first, second) => first.at - second.at)
}
