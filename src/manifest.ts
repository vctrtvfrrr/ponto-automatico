import pkg from '../package.json' with { type: 'json' }

export const manifest = {
  manifest_version: 3,
  name: 'Ponto Automático',
  description: 'Registra as Marcações do dia no PontoMais a partir da Escala declarada.',
  version: pkg.version,
  permissions: ['storage', 'alarms', 'notifications'],
  // activeTab is deliberately absent: it needs a user gesture, and no gesture
  // exists at the instant a Trigger fires.
  host_permissions: ['https://app2.pontomais.com.br/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'src/icons/icon-16.png',
      32: 'src/icons/icon-32.png',
      48: 'src/icons/icon-48.png',
      128: 'src/icons/icon-128.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  icons: {
    16: 'src/icons/icon-16.png',
    32: 'src/icons/icon-32.png',
    48: 'src/icons/icon-48.png',
    128: 'src/icons/icon-128.png',
  },
} satisfies chrome.runtime.ManifestV3
