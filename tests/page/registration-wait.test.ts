import { afterEach, expect, test, vi } from 'vitest'
import type { RegistrationReport } from '../../src/page/messages.ts'
import { localDate } from '../../src/triggers/plan.ts'

afterEach(() => vi.unstubAllGlobals())

// Scripts the Attempt's tabs: registration reads come from `reports`, one per
// poll, and the WorkDay read gains the Punch once the click has been sent, so
// the confirmation loop resolves instead of running out its own minute.
function stubChrome(reports: RegistrationReport[]) {
  const now = new Date()
  const date = localDate(now)
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const sent: { type: string }[] = []
  let created = 0
  let clicked = false

  vi.stubGlobal('chrome', {
    tabs: {
      create: async () => ({ id: ++created }),
      get: async (id: number) => ({ id, url: 'https://app2.pontomais.com.br/' }),
      remove: async () => {},
      sendMessage: async (_id: number, message: { type: string }) => {
        sent.push(message)
        if (message.type === 'read-registration') return reports.shift() ?? reports.at(-1)
        if (message.type === 'read-work-day') {
          return { status: 'read', workDay: { date, punches: clicked ? [time] : [] }, observedAt: Date.now() }
        }
        clicked = true
        return { result: 'clicked', at: Date.now() }
      },
    },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  })

  const at = now.getTime()
  return { sent, date, trigger: { slot: 0, at, window: { start: at - 60_000, end: at + 60_000 } } }
}

const reads = (sent: { type: string }[], type: string) => sent.filter((message) => message.type === type)

test('keeps polling while the button is disabled instead of taking it as the answer', async () => {
  const { performPunch } = await import('../../src/background/page.ts')
  const { sent, date, trigger } = stubChrome([
    { observation: 'disabled', structural: 2, rendered: 1 },
    { observation: 'disabled', structural: 2, rendered: 1 },
    { observation: 'ready', structural: 2, rendered: 1 },
  ])
  const timelines: RegistrationReport[][] = []

  const outcome = await performPunch(date, trigger, 30, async () => {}, async () => {}, async (timeline) => {
    timelines.push(timeline)
  })

  expect(reads(sent, 'read-registration')).toHaveLength(3)
  expect(reads(sent, 'click-punch')).toHaveLength(1)
  expect(outcome.result).toBe('confirmed')
  expect(timelines[0]?.map((entry) => entry.observation)).toEqual(['disabled', 'ready'])
})

test('records the candidate counts, so an Attempt says whether a read was ambiguous', async () => {
  const { performPunch } = await import('../../src/background/page.ts')
  const { date, trigger } = stubChrome([
    { observation: 'missing', structural: 3, rendered: 2 },
    { observation: 'ready', structural: 2, rendered: 1 },
  ])
  const timelines: RegistrationReport[][] = []

  await performPunch(date, trigger, 30, async () => {}, async () => {}, async (timeline) => {
    timelines.push(timeline)
  })

  expect(timelines[0]).toMatchObject([
    { observation: 'missing', structural: 3, rendered: 2 },
    { observation: 'ready', structural: 2, rendered: 1 },
  ])
})
