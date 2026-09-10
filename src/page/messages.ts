import type { Trigger } from '../triggers/plan.ts'
import type { PunchOutcome } from '../triggers/punch.ts'
import type { WorkDay } from './readers.ts'
import type { PageObservation, RegistrationObservation } from './observation.ts'

export const READ_WORK_DAY = 'read-work-day'
export type ReadWorkDayMessage = { type: typeof READ_WORK_DAY; date: string }
export type ReadWorkDayResponse = PageObservation & { observedAt: number }

export const READ_REGISTRATION = 'read-registration'
// The counts travel with the observation so an Attempt records why a read said
// 'missing': no candidate at all, or more than one, or none with a layout box.
export type RegistrationReport = { observation: RegistrationObservation; structural: number; rendered: number }
export type RegistrationTimeline = (RegistrationReport & { at: number })[]
export const CLICK_PUNCH = 'click-punch'
export type ClickPunchMessage = {
  type: typeof CLICK_PUNCH
  trigger: Trigger
  toleranceMinutes: number
  workDay: WorkDay
  observedAt: number
}
export type ClickPunchResponse = { result: 'clicked'; at: number } | PunchOutcome
export type PageMessage = ReadWorkDayMessage | { type: typeof READ_REGISTRATION } | ClickPunchMessage

export const GET_TODAY_WORK_DAY = 'get-today-work-day'
export type WorkDaySnapshot = { observedAt: number; workDay: WorkDay }
export type TodayWorkDayResponse = ReadWorkDayResponse | { error: string }
