// @vitest-environment happy-dom
import { beforeEach, expect, test } from 'vitest'
import table from '../fixtures/my-point-table.html?raw'
import login from '../fixtures/login-form.html?raw'
import register from '../fixtures/register-widget.html?raw'
import { isLoginPage, readWorkDay } from '../../src/page/readers.ts'

const now = new Date(2026, 2, 3, 9, 30)

beforeEach(() => { document.body.innerHTML = table })

test('reads all four Punches from the title instead of the abbreviated visible text', () => {
  expect(readWorkDay(document, '2026-03-01', now)).toEqual({
    date: '2026-03-01', punches: ['09:02', '12:07', '13:11', '18:04'],
  })
})

test('distinguishes an empty WorkDay from an unreadable page', () => {
  expect(readWorkDay(document, '2026-03-02', now)).toEqual({ date: '2026-03-02', punches: [] })
  document.querySelector('vrgente-my-point-table')!.remove()
  expect(readWorkDay(document, '2026-03-02', now)).toBeUndefined()
})

test('infers the year within the default last 30 days, including the turn of the year', () => {
  const cell = document.querySelector('tr.dx-data-row [aria-colindex="3"]')!
  cell.textContent = 'qui - 31/12'
  const january = new Date(2027, 0, 1, 0, 5)

  expect(readWorkDay(document, '2026-12-31', january)).toEqual({ date: '2026-12-31', punches: ['09:02'] })
  expect(readWorkDay(document, '2027-12-31', january)).toBeUndefined()
  expect(readWorkDay(document, '2026-03-01', january)).toBeUndefined()
})

test.each(['09:02 - invalid', '24:00', '09:02 - 08:00', '09:02 - 09:02', ''])('rejects an incomplete or invalid Punch list: %s', (title) => {
  document.querySelector('tr.dx-data-row [aria-colindex="5"] span[title]')!.setAttribute('title', title)
  expect(readWorkDay(document, '2026-03-03', now)).toBeUndefined()
})

test('recognizes the captured login form without confusing the registration PIN with login', () => {
  document.body.innerHTML = login
  expect(isLoginPage(document)).toBe(true)
  document.body.innerHTML = register
  expect(isLoginPage(document)).toBe(false)
  document.body.innerHTML = table
  expect(isLoginPage(document)).toBe(false)
})

test('resolves reordered columns by their headers and reads an ongoing WorkDay', () => {
  document.querySelectorAll('[aria-colindex="5"]').forEach((cell) => cell.setAttribute('aria-colindex', '11'))
  document.querySelectorAll('[aria-colindex="3"]').forEach((cell) => cell.setAttribute('aria-colindex', '12'))
  expect(readWorkDay(document, '2026-03-03', now)).toEqual({ date: '2026-03-03', punches: ['09:02'] })
})

test('rejects missing and ambiguous WorkDays instead of assuming the first row is today', () => {
  expect(readWorkDay(document, '2026-03-04', new Date(2026, 2, 4))).toBeUndefined()
  const row = document.querySelector('tr.dx-data-row')!
  row.parentElement!.append(row.cloneNode(true))
  expect(readWorkDay(document, '2026-03-03', now)).toBeUndefined()
})

test('rejects a missing Punch header or title instead of guessing a column or reading visible text', () => {
  document.querySelector('[aria-label="Coluna Entrada/Saída"]')!.remove()
  expect(readWorkDay(document, '2026-03-01', now)).toBeUndefined()
  document.body.innerHTML = table
  document.querySelectorAll('span[title]').forEach((span) => span.removeAttribute('title'))
  expect(readWorkDay(document, '2026-03-01', now)).toBeUndefined()
})

test('rejects ambiguous grids and Punch lists instead of accepting the first match', () => {
  const grid = document.querySelector('vrgente-my-point-table')!
  document.body.append(grid.cloneNode(true))
  expect(readWorkDay(document, '2026-03-03', now)).toBeUndefined()
  document.body.innerHTML = table
  const span = document.querySelector('tr.dx-data-row [aria-colindex="5"] span[title]')!
  span.parentElement!.append(span.cloneNode(true))
  expect(readWorkDay(document, '2026-03-03', now)).toBeUndefined()
})
