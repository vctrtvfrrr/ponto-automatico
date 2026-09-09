# Ponto Automático

Extensão do Chrome que registra as Marcações do dia no PontoMais a partir de uma Escala declarada. O vocabulário do domínio está em `CONTEXT.md`; as decisões já tomadas, em `docs/adr/`.

Nesta versão a extensão instala, abre e guarda a Escala editada na página de opções. Ela ainda não registra Marcações.

## Instalar

```sh
npm install
npm run build
```

Em `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha o diretório `dist/`.

O Modo do desenvolvedor precisa continuar ligado: o Chrome remove extensões descompactadas na inicialização quando ele está desligado.

## CI e download da extensão

O workflow verifica os tipos e executa os testes em todo push de branch ou tag `v*`. No push de uma tag `v*`, após as verificações passarem, ele gera o build e anexa `ponto-automatico-chrome.zip` ao Release dessa tag. Se o Release não existir, o workflow cria um com o nome da tag.

1. Na página **Releases** do Gitea, abra o Release da versão desejada após o workflow terminar.
2. Baixe o anexo `ponto-automatico-chrome.zip`.
3. Extraia o ZIP para uma pasta permanente.
4. Em `chrome://extensions`, ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.

O workflow usa Node.js 24 e precisa de um runner Linux com o rótulo `ubuntu-latest` e os comandos `bash`, `zip`, `curl` e `jq`. A publicação usa o `GITEA_TOKEN` automático com permissão `releases: write`, que as configurações do repositório precisam permitir.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera `dist/`, o diretório que o Chrome carrega |
| `npm run dev` | Build em watch, recarregando a extensão |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Suíte de testes |
