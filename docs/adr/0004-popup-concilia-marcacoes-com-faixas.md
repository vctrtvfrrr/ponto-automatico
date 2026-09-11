# ADR-0004 — O popup deriva o estado de cada Gatilho conciliando Marcações com faixas

O popup mostra os Gatilhos de hoje numa lista única, cada um com o seu desfecho. Esse desfecho **não** vem da Tentativa: `GET_TODAY_TRIGGERS` devolve apenas o plano do dia, e o popup deriva o estado por conta própria, atribuindo a cada Gatilho, em ordem cronológica, a primeira Marcação ainda não atribuída que caia no intervalo `[window.start, at + Tolerância]`. A razão é escopo: a alternativa obrigaria a estender um contrato de mensagem para enfeitar uma tela, e a pergunta que o popup responde — "já marcou?" — é respondida por inteiro pela conciliação.

## Considered Options

**Devolver o `StoredTrigger` com a sua Tentativa.** Recusada por ora: é a única forma de a tela dizer *por que* um Gatilho falhou, mas essa causa já chega ao usuário pelo Aviso, e pagar por ela uma mudança no contrato entre o service worker e o popup é caro para o ganho. Fica registrada como trabalho futuro, não como erro.

**Conciliar pela `window` pura, sem estender pela Tolerância.** Recusada: o alarme do Chrome atrasa rotineiramente quando o navegador está ocioso, e a Tentativa roda em `at + atraso`. Como `at` já pode estar perto do fim da faixa, uma Marcação **bem-sucedida** nasce com frequência depois de `window.end` — e a faixa pura a exibiria como Gatilho falhado mais uma Marcação órfã. Reportar um erro que não houve é o erro caro: destrói a confiança em todas as outras linhas.

## Consequences

**A semântica de "este Gatilho produziu Marcação" passa a existir em dois lugares.** `decidePunch` decide `already-filled` pela `window`; o popup decide "cumprido" pela faixa estendida. As duas regras não são iguais e nem deveriam ser — uma decide se ainda vale clicar, a outra se já aconteceu —, mas ambas se apoiam em `Trigger.window`. Mudar a faixa no domínio sem mudar o popup faz a tela mentir com confiança, e nenhum teste liga as duas pontas.

**A Tolerância atual reinterpreta o passado.** A faixa fica salva junto do Gatilho, mas a Tolerância que a estende é lida da Escala no instante em que o popup abre — não é a que valia quando a Tentativa rodou. Reduzir a Tolerância nas opções transforma, sem que nada tenha acontecido, um Gatilho cumprido em Gatilho falhado mais uma Marcação órfã. Recuperar a Tolerância histórica exige a Tentativa, que é exatamente o que esta decisão recusou trazer; o custo aparece aqui.

**O popup não afirma desfecho que a Jornada lida não sustente.** "Falhou" e "aguardando" são afirmações sobre a Jornada, e uma Jornada nunca lida — ou lida antes do momento em questão — não sustenta nenhuma das duas. Sem essa evidência a linha diz apenas "sem leitura". A alternativa era tratar a ausência de leitura como Jornada vazia, o que acusa de falha todo Gatilho passado sempre que a sessão expira, e pode levar o usuário a uma Marcação manual duplicada.

**O popup não diz por que um Gatilho falhou.** Gatilho passado, fora da Tolerância e sem Marcação atribuída é "falhou", tanto faz se a sessão expirou, se o botão sumiu ou se o worker foi derrubado.

**Gatilho sem `window` não concilia.** A faixa é opcional no tipo, e Gatilhos gravados por versões anteriores não a têm. A linha aparece neutra, só com o horário: `decidePunch` também se recusa a decidir sem faixa válida, e a tela não deve ser mais corajosa que o domínio.

**Dois intervalos estendidos podem se sobrepor.** `validateSchedule` garante que duas `window` vizinhas nunca se sobrepõem, mas não estende essa garantia à Tolerância: com Tolerância grande e horários próximos, uma Marcação cai em dois intervalos. A atribuição gulosa em ordem cronológica, consumindo cada Marcação no máximo uma vez, torna o resultado determinístico — não necessariamente o que um humano escolheria.
