import type { RegistrationTimeline } from '../page/messages.ts'
import type { WorkDay } from '../page/readers.ts'
import type { AttemptDecision } from './attempt.ts'
import type { Trigger } from './plan.ts'
import type { PunchOutcome } from './punch.ts'

export type AttemptOutcome = Exclude<AttemptDecision, { result: 'wait' }> | PunchOutcome

export type Attempt = {
  at: number
  decision: AttemptOutcome
  tabIds?: number[]
  workDay?: WorkDay
  registration?: RegistrationTimeline
}

// Each channel carries its own delivery mark, so one failing never holds the
// other back.
export type StoredTrigger = {
  date: string
  trigger: Trigger
  attempt?: Attempt
  notified?: boolean
  pushed?: boolean
}
