import type { AutomationState } from './state.ts'

export async function loadAutomation(): Promise<AutomationState> {
  const { automation } = await chrome.storage.local.get('automation')
  if (automation === undefined) return { enabled: true }
  if (!isAutomationState(automation)) {
    throw new Error('O estado da automação armazenado tem formato inválido.')
  }
  return automation
}

function isAutomationState(value: unknown): value is AutomationState {
  return typeof value === 'object' && value !== null &&
    'enabled' in value && typeof value.enabled === 'boolean' &&
    (!('resumedAt' in value) || (typeof value.resumedAt === 'number' && Number.isFinite(value.resumedAt)))
}

export async function saveAutomationEnabled(enabled: boolean): Promise<void> {
  const current = await loadAutomation()
  if (current.enabled === enabled) return
  const automation: AutomationState = enabled ? { enabled, resumedAt: Date.now() } : { enabled }
  await chrome.storage.local.set({ automation })
}
