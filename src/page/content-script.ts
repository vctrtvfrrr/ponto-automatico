import { READ_WORK_DAY, type ReadWorkDayMessage } from './messages.ts'
import type { PageObservation } from './observation.ts'
import { isLoginPage, readWorkDay } from './readers.ts'

chrome.runtime.onMessage.addListener((message: ReadWorkDayMessage, _sender, sendResponse: (response: PageObservation) => void) => {
  if (message?.type !== READ_WORK_DAY || typeof message.date !== 'string') return
  if (isLoginPage(document)) {
    sendResponse({ status: 'login' })
    return
  }
  const workDay = location.pathname === '/meu-ponto' ? readWorkDay(document, message.date, new Date()) : undefined
  sendResponse(workDay ? { status: 'read', workDay } : { status: 'unreadable' })
})
