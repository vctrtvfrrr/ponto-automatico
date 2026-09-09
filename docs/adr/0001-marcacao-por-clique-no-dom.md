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

Na implementação da issue #9, o usuário definiu o reconhecimento por proximidade: a faixa é o horário nominal da Escala mais ou menos o desvio do sorteio, com limites incluídos. A extensão guarda essa faixa junto do Gatilho. A contagem de Marcações não determina se um horário está preenchido, pois uma Marcação anterior pode faltar. Gatilhos antigos sem essa faixa abortam e notificam, sem inferir a Escala usada no sorteio.

A Tentativa prepara a página de registro antes de consultar uma nova cópia da Jornada. O content script exige uma leitura feita há no máximo dois segundos antes do clique. Durante a confirmação, a página de registro permanece aberta e cada consulta da Jornada usa uma aba nova. Isso evita consultar uma tabela antiga sem atualização e preserva o envio da página de registro. O clique não será repetido, mesmo quando sua resposta se perder.

O DOM não oferece uma operação atômica entre consultar a Jornada e criar a Marcação. Uma Marcação manual simultânea, ainda ausente da lista consultada, continua sendo uma limitação. A trava persistente impede que a extensão repita a mesma Tentativa após uma interrupção. Ela não coordena Marcações feitas por outros dispositivos.
