# ADR-0003 — Push dos Avisos pelo ntfy.sh, em servidor fixo e sem autenticação

Todo Aviso sai também como push no `ntfy.sh`, por um `POST` do service worker para `https://ntfy.sh/{tópico}`, com a mensagem no corpo e os metadados nos cabeçalhos `Title`, `Priority`, `Tags` e `Click`. O servidor é fixo e o único dado configurável é o nome do tópico.

A extensão **não declara permissão de host** para o `ntfy.sh`. O `POST` se apoia no `access-control-allow-origin: *` que o serviço responde, verificado contra o servidor real tanto no preflight quanto no `POST`; o preflight também responde `access-control-allow-headers: *`, o que cobre os cabeçalhos de metadados. O CORS aberto é parte do produto deles, não um acidente. Atualizar a extensão não pede nenhuma aprovação nova de quem já a tem instalada — essa é a razão da decisão, e o teste do manifesto é a sua verificação prática.

O `Title` viaja codificado em RFC 2047 (`=?UTF-8?B?…?=`). O `fetch` recusa um valor de cabeçalho com ponto de código acima de 255, e o travessão do título está acima; o `ntfy.sh` decodifica e mostra o título original.

O tópico é sugerido pela própria extensão quando ainda não há um salvo: o prefixo público `ponto-automatico-` seguido de 16 caracteres sorteados de `A-Za-z0-9` com `crypto.getRandomValues`. Como o prefixo é previsível, todo o orçamento de imprevisibilidade está nos 16 caracteres — cerca de 2⁹⁵ combinações, contra as 2⁶⁰ que a documentação do ntfy usa como referência de "tão bom quanto uma boa senha". O campo inteiro é editável, prefixo incluído, e aceita qualquer valor que case `[-_A-Za-z0-9]{1,64}`.

## Considered Options

**Suportar um servidor self-hosted.** Recusada: um host configurável exige permissão de host opcional e um pedido de permissão em tempo de execução, no meio do uso. O ganho não paga esse custo para um usuário só.

**Oferecer um campo de token.** Recusada: no `ntfy.sh` gratuito não há ACL, e a documentação deles é explícita em que o nome do tópico é a senha. Um campo que sugere proteção sem entregá-la é pior que nenhum campo.

**Deixar o usuário inventar o nome do tópico.** Recusada como padrão: um nome escolhido à mão tende a ser curto e adivinhável, e no `ntfy.sh` adivinhar o tópico é ler os horários de ponto de quem o usa. A sugestão sorteada continua sendo só uma sugestão — o campo aceita ser substituído inteiro.

## Consequences

**O push só acontece para Gatilho cuja data é a de hoje.** Nada apaga os Gatilhos gravados, e a rotina que garante os alarmes percorre todos eles a cada despertar do worker. Sem essa regra, um `ntfy.sh` inacessível faria a extensão disparar um `POST` por Gatilho de cada dia passado a cada despertar, o que o limite de uma requisição a cada dez segundos do serviço responderia com banimento. A mesma regra resolve a migração: os Gatilhos já gravados não são de hoje, então ligar o recurso não empurra o histórico.

**Um push que não saiu até a virada do dia não sai nunca.** É a consequência aceita da regra acima. O Aviso do navegador correspondente sai do mesmo jeito, porque cada canal tem o seu próprio marcador de entrega.

**O conteúdo do Aviso trafega em claro para um terceiro.** O `ntfy.sh` vê o título, a mensagem e o horário de cada Marcação. Quem souber o nome do tópico também vê. É o preço de um canal sem servidor próprio e sem conta.

Se algum dia o CORS do `ntfy.sh` fechar, o sintoma será uma falha de rede sem causa legível no service worker. A correção é declarar o host no manifesto — a opção considerada e recusada aqui.
