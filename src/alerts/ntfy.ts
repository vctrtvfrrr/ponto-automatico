import type { Alert } from './alert.ts'
import { loadAlertSettings } from './storage.ts'

const SERVER = 'https://ntfy.sh'
const WORK_DAY = 'https://app2.pontomais.com.br/meu-ponto'

// No host permission: the POST rides on the `access-control-allow-origin: *`
// that ntfy.sh serves, which is part of their product. See ADR-0003.
export async function pushAlert(alert: Alert): Promise<boolean> {
  const topic = (await loadAlertSettings())?.topic
  if (!topic) return false

  try {
    const response = await fetch(`${SERVER}/${topic}`, {
      method: 'POST',
      headers: {
        Title: encodeHeader(alert.title),
        Priority: alert.priority,
        Tags: alert.tags.join(','),
        Click: WORK_DAY,
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
