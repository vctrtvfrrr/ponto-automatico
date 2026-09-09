import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

// Presence only. Synchronicity is not observable from here: `await import`
// resolves after module evaluation, so a listener added in a microtask or
// behind a top-level await would pass this too. Chrome is the real check — it
// records a freshly evaluated worker's events under `serviceworkerevents`.
test('loading the service worker registers wake, Trigger and popup listeners', async () => {
  const registered: string[] = []
  const slot = (event: string) => ({
    addListener: () => {
      registered.push(event)
    },
  })

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: slot('runtime.onInstalled'),
      onStartup: slot('runtime.onStartup'),
      onMessage: slot('runtime.onMessage'),
    },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    alarms: { onAlarm: slot('alarms.onAlarm'), get: async () => undefined, create: async () => {} },
  })
  vi.resetModules()

  await import('../src/background/service-worker')

  expect(registered).toEqual(['runtime.onInstalled', 'runtime.onStartup', 'alarms.onAlarm', 'runtime.onMessage'])
})
