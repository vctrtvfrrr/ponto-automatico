// Listeners must be registered during the initial synchronous evaluation of this
// script. The worker is torn down after 30 s idle, and Chrome only delivers an
// event to a listener that the freshly woken script has already registered.
chrome.runtime.onInstalled.addListener(handleWake)
chrome.runtime.onStartup.addListener(handleWake)

function handleWake(): void {
  // TODO(#5): plan the day — draw today's Triggers from the Schedule and create
  // one alarm per Trigger. Nothing may be cached in memory between wakes.
}

export {}
