export const ALERTS_KEY = 'alerts'

export type AlertSettings = { topic: string }

// Absent settings and a corrupt value both read as never configured, never as
// a throw: the Alert settings are a delivery address, and one must not take the
// day's planning down with it the way an unreadable Schedule does. A stored
// empty topic is a decision — the push turned off — and stays as it is.
export async function loadAlertSettings(): Promise<AlertSettings | undefined> {
  const stored = await chrome.storage.local.get(ALERTS_KEY)
  const alerts: unknown = stored[ALERTS_KEY]
  if (typeof alerts !== 'object' || alerts === null) return undefined
  if (!('topic' in alerts) || typeof alerts.topic !== 'string') return undefined

  return { topic: alerts.topic }
}

// Runtime state, in a key of its own: the Options screen replaces the whole
// `alerts` object on every save.
export const PUSH_ALLOWED_AT_KEY = 'pushAllowedAt'

export async function loadPushAllowedAt(): Promise<number> {
  const stored = await chrome.storage.local.get(PUSH_ALLOWED_AT_KEY)
  const at: unknown = stored[PUSH_ALLOWED_AT_KEY]

  return typeof at === 'number' && Number.isFinite(at) ? at : 0
}

export async function savePushAllowedAt(at: number): Promise<void> {
  await chrome.storage.local.set({ [PUSH_ALLOWED_AT_KEY]: at })
}
