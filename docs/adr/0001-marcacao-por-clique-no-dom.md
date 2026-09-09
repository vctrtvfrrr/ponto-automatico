# ADR-0001 — Marcação por clique no DOM, não pela API

A extensão injeta um content script na página logada do PontoMais e clica o botão real de registrar, em vez de montar a requisição de registro por conta própria. O clique carrega localização, token, dispositivo e versão exatamente como uma Marcação manual, sem que a extensão precise obter, guardar ou fabricar nenhum desses valores.

## Considered Options

**`fetch` do service worker replicando o payload.** Recusada porque replicar o payload exige o registro inteiro do colaborador — configuração de turno e histórico de fechamentos incluídos. A extensão teria de obter e manter tudo isso sozinha, ou lê-lo da memória do app, que é justamente a dependência de internals recusada na opção seguinte. O payload também exige latitude, longitude e endereço, e o desenho proíbe afirmar uma localização que não seja a real.

A issue #1 apoiava esta recusa em outro argumento: que o Devise Token Auth rotaciona o par `access-token`/`expiry` a cada requisição, fazendo extensão e aba invalidarem a sessão uma da outra. A pesquisa da issue #3 não sustenta isso — a resposta do registro não devolve `access-token`, `expiry`, `client` nem `uid`. Uma amostra única não prova que o sistema nunca rotaciona, mas esta decisão não se apoia mais nesse argumento.

**`fetch` injetado no contexto da página, reusando o cliente HTTP do app.** Recusada. Depende de alcançar internals de um bundle Webpack servido como micro-frontend, sem âncora estável e mais volátil que o DOM.

Fica igualmente fora a API oficial de integração do PontoMais: é add-on pago de nível empresa, contratado pelo admin da conta.

## Consequences

O seletor do botão é a fragilidade central do projeto — a interface é um bundle com classes hasheadas, e uma mudança de layout deixa a extensão sem marcar. A Tentativa tem de falhar alto: abortar e notificar, nunca falhar em silêncio.

Achar o botão não basta. A pesquisa da issue #3 registra duas condições que o clique não controla:

- **O botão nasce `disabled` quando a localização expira.** A Tentativa tem de verificar se ele está habilitado, e tratar localização expirada como motivo de abortar-e-notificar em vez de clicar.
- **A Jornada não vive na tela de registro.** `/registrar-ponto` mostra apenas a Marcação mais recente; a lista do dia está em `/meu-ponto`. A issue #1 assume "a lista de Marcações do dia lida na própria página" como fonte de verdade da idempotência — são duas rotas, e a ordenação entre ler e clicar ainda não foi verificada. Decidir sobre uma leitura desatualizada é o caminho para a Marcação duplicada, que é a única coisa que a Tentativa jamais pode fazer. Quando a Jornada corrente não puder ser identificada inequivocamente, a Tentativa aborta.

A resposta do registro é `202 Accepted`, não `201 Created`: o servidor aceita a Marcação para processamento e não afirma que ela existe. "Cliquei" nunca é prova de "registrou" — a confirmação relê a lista do dia.

Na issue #8, o usuário confirmou que `/meu-ponto` usa os últimos 30 dias como filtro padrão e não exibe o ano. Ele autorizou inferir o ano a partir desse intervalo. A leitura usa uma aba nova, sem alterar os filtros, e exige uma única linha correspondente à data do Gatilho. Uma Jornada ausente ou ambígua continua sendo motivo para abortar.

A permissão de host declarada no manifest cobre apenas `app2.pontomais.com.br` e é suficiente exatamente porque esta decisão vale: a extensão fala com a página, não com a API, que vive em `api.pontomais.com.br`.
