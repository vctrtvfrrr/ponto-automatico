import type { DailyTriggers } from './plan.ts'

export const GET_TODAY_TRIGGERS = 'get-today-triggers'

export type TodayTriggersResponse = { day: DailyTriggers } | { error: string }
