import { expect, test } from 'vitest'
import scheduleSource from '../../src/schedule/schedule.ts?raw'
import validateSource from '../../src/schedule/validate.ts?raw'

// Acceptance criterion of #4: the validation module carries no extension API, so
// it stays testable outside a browser and reusable by the decision module.
const PURE_MODULES: [name: string, source: string, allowedImports: string[]][] = [
  ['schedule.ts', scheduleSource, []],
  ['validate.ts', validateSource, ['./schedule.ts']],
]

test.each(PURE_MODULES)('%s imports nothing from the extension APIs', (_name, source, allowed) => {
  const imports = [...source.matchAll(/\bfrom\s+'([^']+)'/g)].map(([, specifier]) => specifier)

  expect(imports).toEqual(allowed)
  expect(source).not.toMatch(/\bchrome\b/)
})
