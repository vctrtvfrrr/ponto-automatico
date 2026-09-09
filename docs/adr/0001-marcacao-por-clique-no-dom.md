# ADR-0001 — Marcação por clique no DOM, não pela API

A extensão injeta um content script na página logada do PontoMais e clica o botão real de registrar, em vez de montar a requisição de registro por conta própria. O clique carrega localização, token, dispositivo e versão exatamente como uma Marcação manual, sem que a extensão precise obter, guardar ou fabricar nenhum desses valores.

## Considered Options

**`fetch` do service worker replicando o payload.** Recusada. O PontoMais autentica com Devise Token Auth, que rotaciona o par `access-token`/`expiry` a cada requisição: extensão e aba passariam a invalidar a sessão uma da outra. O payload também exige latitude, longitude e endereço, que a extensão teria de obter por conta própria — e o desenho proíbe afirmar uma localização que não seja a real.

**`fetch` injetado no contexto da página, reusando o cliente HTTP do app.** Recusada. Depende de alcançar internals de um bundle Webpack servido como micro-frontend, sem âncora estável e mais volátil que o DOM.

Fica igualmente fora a API oficial de integração do PontoMais: é add-on pago de nível empresa, contratado pelo admin da conta.

## Consequences

O seletor do botão passa a ser a fragilidade central do projeto — a interface é um bundle com classes hasheadas, e uma mudança de layout deixa a extensão sem marcar. A Tentativa tem, portanto, de falhar alto: abortar e notificar quando o botão não for encontrado, nunca falhar em silêncio.

A permissão de host declarada no manifest cobre apenas `app2.pontomais.com.br` e é suficiente exatamente porque esta decisão vale: a extensão fala com a página, não com a API.
