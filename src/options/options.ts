import { WEEKDAYS, type Schedule, type ScheduleError, type Weekday } from '../schedule/schedule.ts'
import { loadSchedule, saveSchedule } from '../schedule/storage.ts'
import { validateSchedule } from '../schedule/validate.ts'

const WEEKDAY_NAMES: Record<Weekday, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

const form = document.querySelector<HTMLFormElement>('#schedule')!
const deviationField = document.querySelector<HTMLInputElement>('#deviation')!
const toleranceField = document.querySelector<HTMLInputElement>('#tolerance')!
const skipDatesField = document.querySelector<HTMLTextAreaElement>('#skip-dates')!
const feedback = document.querySelector<HTMLElement>('#feedback')!

const { name: extensionName, version } = chrome.runtime.getManifest()
document.querySelector('#build')!.textContent = `${extensionName} ${version}`

const timeFields = buildTimeFields()
let editable = true

fill(await loadSchedule())

form.addEventListener('input', () => {
  if (feedback.className === 'saved') clearFeedback()
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!editable) return

  const schedule = read()
  const errors = validateSchedule(schedule)

  if (errors.length > 0) {
    report('errors', 'A Escala não foi salva. Corrija o que está abaixo.', errors.map(describe))
    return
  }

  setEditable(false)
  report('saving', 'Salvando…', [])

  try {
    await saveSchedule(schedule)
    report('saved', 'Escala salva.', [])
  } catch (refusal) {
    report('errors', 'A Escala não foi salva: o armazenamento recusou a gravação.', [
      refusal instanceof Error ? refusal.message : String(refusal),
    ])
  } finally {
    setEditable(true)
  }
})

function setEditable(enabled: boolean): void {
  editable = enabled
  const controls = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
    'input, textarea, button',
  )
  controls.forEach((control) => {
    control.disabled = !enabled
  })
}

function buildTimeFields(): Record<Weekday, HTMLInputElement> {
  const container = document.querySelector('#weekdays')!
  const fields = {} as Record<Weekday, HTMLInputElement>

  for (const weekday of WEEKDAYS) {
    const field = document.createElement('input')
    field.id = `times-${weekday}`
    field.type = 'text'
    field.placeholder = 'sem Marcações'

    const label = document.createElement('label')
    label.htmlFor = field.id
    label.textContent = WEEKDAY_NAMES[weekday]

    container.append(label, field)
    fields[weekday] = field
  }

  return fields
}

function fill(schedule: Schedule): void {
  for (const weekday of WEEKDAYS) {
    timeFields[weekday].value = schedule.times[weekday].join(', ')
  }

  deviationField.value = String(schedule.deviationMinutes)
  toleranceField.value = String(schedule.toleranceMinutes)
  skipDatesField.value = schedule.skipDates.join('\n')
}

function read(): Schedule {
  const times = {} as Record<Weekday, string[]>
  for (const weekday of WEEKDAYS) {
    times[weekday] = splitEntries(timeFields[weekday].value, ',')
  }

  return {
    times,
    // `valueAsNumber` is NaN for an empty or unparseable field, which the
    // validator rejects; `Number('')` would quietly read as zero.
    deviationMinutes: deviationField.valueAsNumber,
    toleranceMinutes: toleranceField.valueAsNumber,
    skipDates: splitEntries(skipDatesField.value, '\n'),
  }
}

function splitEntries(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

function clearFeedback(): void {
  feedback.className = ''
  feedback.replaceChildren()
}

function report(tone: 'errors' | 'saved' | 'saving', heading: string, details: string[]): void {
  const title = document.createElement('p')
  title.textContent = heading

  const list = document.createElement('ul')
  for (const detail of details) {
    const item = document.createElement('li')
    item.textContent = detail
    list.append(item)
  }

  feedback.className = tone
  feedback.replaceChildren(title, list)
}

function describe(error: ScheduleError): string {
  const day = 'weekday' in error ? WEEKDAY_NAMES[error.weekday] : ''

  switch (error.kind) {
    case 'malformed-time':
      return `${day}: "${error.value}" não é um horário. Use HH:MM, como 08:30.`
    case 'times-out-of-order':
      return `${day}: ${error.second} não vem depois de ${error.first}. Os horários do dia precisam estar em ordem crescente.`
    case 'deviation-overlaps-times':
      return `${day}: com desvio de ${error.deviationMinutes} minutos, os sorteios de ${error.first} e ${error.second} podem cair no mesmo instante ou trocar de ordem. Afaste os horários ou reduza o desvio.`
    case 'deviation-crosses-midnight':
      return `${day}: com desvio de ${error.deviationMinutes} minutos, o sorteio de ${error.time} pode cair em outro dia. Afaste o horário da meia-noite ou reduza o desvio.`
    case 'invalid-deviation':
      return 'O desvio precisa ser um número inteiro de minutos, zero ou maior.'
    case 'invalid-tolerance':
      return 'A tolerância precisa ser um número inteiro de minutos, zero ou maior.'
    case 'malformed-skip-date':
      return `Exceção "${error.value}" não é uma data real. Use AAAA-MM-DD, como 2026-12-25.`
  }
}
