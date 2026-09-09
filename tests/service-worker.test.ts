import { expect, test, vi } from 'vitest'

function stubChrome(registrations: string[]): void {
  const slot = (event: string) => ({
    addListener: () => {
      registrations.push(event)
    },
  })

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: slot('runtime.onInstalled'),
      onStartup: slot('runtime.onStartup'),
    },
    // A read that never settles. A listener registered behind an await on this
    // is never registered at all, which is the MV3 failure under test.
    storage: { local: { get: () => new Promise<never>(() => {}) } },
  })
}

test('loading the service worker registers the wake listeners', async () => {
  const registrations: string[] = []
  stubChrome(registrations)
  vi.resetModules()

  await import('../src/background/service-worker')

  expect(registrations).toEqual(['runtime.onInstalled', 'runtime.onStartup'])
})
