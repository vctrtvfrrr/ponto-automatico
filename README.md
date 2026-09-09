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

O workflow executa `npm test` em todo push. Na branch `main`, após os testes passarem, ele executa `npm run build` e disponibiliza o artefato `ponto-automatico-chrome`.

1. Na aba **Actions** do Gitea, abra uma execução bem-sucedida da `main`.
2. Baixe o ZIP do artefato `ponto-automatico-chrome`.
3. Extraia o ZIP para uma pasta permanente.
4. Em `chrome://extensions`, ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída que contém `manifest.json`.

O workflow usa Node.js 24 e precisa de um runner Linux com o rótulo `ubuntu-latest`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run build` | Gera `dist/`, o diretório que o Chrome carrega |
| `npm run dev` | Build em watch, recarregando a extensão |
| `npm run typecheck` | Verificação de tipos |
| `npm test` | Suíte de testes |
