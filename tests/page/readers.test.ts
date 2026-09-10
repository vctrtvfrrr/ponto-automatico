// @vitest-environment happy-dom
import { beforeEach, expect, test } from 'vitest'
import table from '../fixtures/my-point-table.html?raw'
import login from '../fixtures/login-form.html?raw'
import register from '../fixtures/register-widget.html?raw'
import buttons from '../fixtures/register-buttons.html?raw'
import { findPunchButtons, isLoginPage, readWorkDay } from '../../src/page/readers.ts'

const now = new Date(2026, 2, 3, 9, 30)

beforeEach(() => { document.body.innerHTML = table })

test('finds the real Punch button in the captured widget and preserves its disabled state', () => {
  document.body.innerHTML = register
  const buttons = findPunchButtons(document)

  expect(buttons).toHaveLength(1)
  expect(buttons[0]?.textContent?.trim()).toBe('Bater ponto')
  expect(buttons[0]?.disabled).toBe(true)
})

test('finds the same button after removing generated attributes and changing design classes', () => {
  document.body.innerHTML = register
  const original = findPunchButtons(document)[0]!
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of element.getAttributeNames()) {
      if (attribute.startsWith('_ng') || attribute === 'class') element.removeAttribute(attribute)
    }
  })
  original.disabled = false

  expect(findPunchButtons(document)).toEqual([original])
  expect(findPunchButtons(document)[0]?.disabled).toBe(false)
})

test('excludes a hidden Punch button and reports a duplicate instead of choosing one', () => {
  document.body.innerHTML = register
  const original = findPunchButtons(document)[0]!
  original.hidden = true
  expect(findPunchButtons(document)).toHaveLength(0)
  original.hidden = false
  original.parentElement!.append(original.cloneNode(true))
  expect(findPunchButtons(document)).toHaveLength(2)
  original.parentElement!.remove()
  expect(findPunchButtons(document)).toHaveLength(0)
})

// The captured route carries three 'Bater ponto' buttons. Reducing the two
// widget copies to one needs layout, which happy-dom does not have: only the
// browser can tell the mobile copy (no box) from the desktop one. That step is
// verified in content-script.ts against the Attempt's own tab, not here.
test('excludes the global Punch shortcut the header carries, keeping both widget copies', () => {
  document.body.innerHTML = buttons
  const found = findPunchButtons(document)

  expect(document.querySelectorAll('pm-button button')).toHaveLength(3)
  expect(document.querySelector('header pm-button.btn-registrar button')?.textContent?.trim()).toBe('Bater ponto')
  expect(found).toHaveLength(2)
  expect(found.map((button) => button.closest('pm-button')?.className)).toEqual([
    'pm-btn-icon btn-register mobile',
    'pm-btn-icon btn-register mt-1',
  ])
})

test('excludes a widget copy the page marks hidden, leaving the other', () => {
  document.body.innerHTML = buttons
  document.querySelector('pm-card.h-mobile')!.setAttribute('hidden', '')

  expect(findPunchButtons(document).map((button) => button.closest('pm-button')?.className))
    .toEqual(['pm-btn-icon btn-register mobile'])
})

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

test('reads a Saturday WorkDay with an accented weekday abbreviation', () => {
  document.querySelector('tr.dx-data-row [aria-colindex="3"]')!.textContent = 'sáb - 07/03'
  expect(readWorkDay(document, '2026-03-07', new Date(2026, 2, 7))).toEqual({ date: '2026-03-07', punches: ['09:02'] })
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
