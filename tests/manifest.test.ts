import { expect, test } from 'vitest'
import { manifest } from '../src/manifest'

const declared: chrome.runtime.ManifestV3 = manifest

test('grants host access to app2.pontomais.com.br and nothing else', () => {
  expect(declared.host_permissions).toEqual(['https://app2.pontomais.com.br/*'])
})

test('declares persistence, Trigger scheduling and failure notifications', () => {
  expect(declared.permissions).toEqual(['storage', 'alarms', 'notifications'])
})

test('never requests activeTab, which needs a gesture no Trigger can provide', () => {
  expect(declared.permissions ?? []).not.toContain('activeTab')
  expect(declared.optional_permissions ?? []).not.toContain('activeTab')
})
