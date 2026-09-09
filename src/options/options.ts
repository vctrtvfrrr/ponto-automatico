export {}

const { name: extensionName, version } = chrome.runtime.getManifest()

document.querySelector('#build')!.textContent = `${extensionName} ${version}`
