import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DEFAULT_SCHEDULE, loadSchedule } from '../../src/schedule/storage.ts'

const get = vi.fn<() => Promise<Record<string, unknown>>>()
const set = vi.fn()

beforeEach(() => {
  get.mockReset()
  set.mockClear()
  vi.stubGlobal('chrome', { storage: { local: { get, set } } })
})

afterEach(() => vi.unstubAllGlobals())

test('uses the reference Schedule only when no Schedule is stored', async () => {
  get.mockResolvedValue({})

  await expect(loadSchedule()).resolves.toEqual(DEFAULT_SCHEDULE)
  expect(get).toHaveBeenCalledWith('schedule')
  expect(set).not.toHaveBeenCalled()
})

test('loads a stored Schedule without changing its values', async () => {
  const schedule = { ...DEFAULT_SCHEDULE, toleranceMinutes: 10, skipDates: ['2026-12-25'] }
  get.mockResolvedValue({ schedule })

  await expect(loadSchedule()).resolves.toEqual(schedule)
  expect(set).not.toHaveBeenCalled()
})

test.each([
  null,
  'invalid',
  [],
  {},
  { times: {} },
  { ...DEFAULT_SCHEDULE, times: null },
  { ...DEFAULT_SCHEDULE, times: {} },
  { ...DEFAULT_SCHEDULE, times: { ...DEFAULT_SCHEDULE.times, 6: '08:30' } },
  { ...DEFAULT_SCHEDULE, times: { ...DEFAULT_SCHEDULE.times, 1: [830] } },
  { ...DEFAULT_SCHEDULE, deviationMinutes: '15' },
  { ...DEFAULT_SCHEDULE, toleranceMinutes: null },
  { ...DEFAULT_SCHEDULE, skipDates: '2026-12-25' },
  { ...DEFAULT_SCHEDULE, skipDates: [null] },
].map((schedule) => ({ schedule })))('rejects incompatible stored data without replacing it: %j', async ({ schedule }) => {
  get.mockResolvedValue({ schedule })

  await expect(loadSchedule()).rejects.toThrow('A Escala armazenada tem formato inválido.')
  expect(set).not.toHaveBeenCalled()
})

test('leaves Schedule rule validation to the validator', async () => {
  const schedule = {
    ...DEFAULT_SCHEDULE,
    times: { ...DEFAULT_SCHEDULE.times, 1: ['invalid', '12:00', '08:30'] },
    deviationMinutes: -1,
    toleranceMinutes: 0.5,
    skipDates: ['invalid'],
  }
  get.mockResolvedValue({ schedule })

  await expect(loadSchedule()).resolves.toEqual(schedule)
})

test('propagates a refused read without writing defaults', async () => {
  const refusal = new Error('Storage unavailable')
  get.mockRejectedValue(refusal)

  await expect(loadSchedule()).rejects.toBe(refusal)
  expect(set).not.toHaveBeenCalled()
})
