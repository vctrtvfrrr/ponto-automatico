import { localDate } from '../triggers/plan.ts'

export type WorkDay = { date: string; punches: string[] }

export function isLoginPage(document: Document): boolean {
  return document.querySelector('login-form input[type="password"]') !== null
}

// The page header carries a global 'Bater ponto' shortcut, present on routes
// that register nothing, and the widget renders a mobile and a desktop copy of
// the real button. Neither copy uses the hidden attribute.
export function findPunchButtons(document: Document): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('pm-button button'))
    .filter((button) => button.textContent?.trim() === 'Bater ponto')
    .filter((button) => !button.closest('[hidden]') && !button.closest('header'))
}

export function readWorkDay(document: Document, date: string, now: Date): WorkDay | undefined {
  // The site's default filter is the last 30 days; its rows omit the year.
  let dayMonth: string | undefined
  for (let offset = 0; offset <= 30; offset++) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    if (localDate(candidate) === date) {
      dayMonth = `${String(candidate.getDate()).padStart(2, '0')}/${String(candidate.getMonth() + 1).padStart(2, '0')}`
      break
    }
  }
  if (!dayMonth) return undefined
  const grids = document.querySelectorAll('vrgente-my-point-table dx-data-grid')
  if (grids.length !== 1) return undefined
  const grid = grids[0]!
  const dateColumn = grid.querySelector('[role="columnheader"][aria-label="Coluna Data"]')?.getAttribute('aria-colindex')
  const punchesColumn = grid.querySelector('[role="columnheader"][aria-label="Coluna Entrada/Saída"]')?.getAttribute('aria-colindex')
  if (!dateColumn || !punchesColumn) return undefined

  const rows = Array.from(grid.querySelectorAll('tr.dx-data-row')).filter((row) => {
    const text = row.querySelector(`[aria-colindex="${dateColumn}"]`)?.textContent
    const match = text?.trim().match(/^\p{L}{3} - (\d{2}\/\d{2})$/u)
    return match?.[1] === dayMonth
  })
  if (rows.length !== 1) return undefined
  const cells = rows[0]!.querySelectorAll(`[aria-colindex="${punchesColumn}"] span[title]`)
  if (cells.length !== 1) return undefined
  const cell = cells[0]!
  const title = cell?.getAttribute('title')
  if (title === '' && cell?.textContent?.trim() === 'Nenhum ponto') return { date, punches: [] }
  if (!title) return undefined
  const punches = title.split(' - ')
  if (punches.some((time, index) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || (index > 0 && time <= punches[index - 1]!))) {
    return undefined
  }
  return { date, punches }
}
