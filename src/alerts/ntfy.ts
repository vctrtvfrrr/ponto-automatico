import type { Alert } from './alert.ts'
import { loadAlertSettings } from './storage.ts'

const SERVER = 'https://ntfy.sh'
const WORK_DAY = 'https://app2.pontomais.com.br/meu-ponto'

// Well under the 30 s Chrome gives a pending fetch before it tears the worker
// down, and short enough that an unreachable ntfy.sh never holds the serialized
// queue that also runs the next Attempt.
const TIMEOUT_MS = 10_000

// No host permission: the POST rides on the `access-control-allow-origin: *`
// that ntfy.sh serves, which is part of their product. See ADR-0003.
export async function pushAlert(alert: Alert, id: string): Promise<boolean> {
  try {
    const topic = (await loadAlertSettings())?.topic
    if (!topic) return false

    const response = await fetch(`${SERVER}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Title: encodeHeader(alert.title),
        Priority: alert.priority,
        Tags: alert.tags.join(','),
        Click: WORK_DAY,
        // The identity the browser channel already gives the Alert. A resend
        // after a lost response then replaces the earlier push in the app
        // instead of stacking a second one. ntfy refuses a colon here.
        'X-Sequence-ID': id.replaceAll(':', '-'),
      },
      body: alert.message,
    })
    return response.ok
  } catch {
    return false
  }
}

// `fetch` refuses a header value holding a code point above 255, which the
// title's em dash is. ntfy.sh decodes RFC 2047 back into the title it shows.
function encodeHeader(value: string): string {
  return `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(value)))}?=`
}
