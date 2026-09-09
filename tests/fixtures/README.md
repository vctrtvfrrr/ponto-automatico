# Fixtures do DOM do PontoMais

Estrutura de DOM capturada da página real logada, em resposta à issue #3. Nenhum destes arquivos teve sua estrutura escrita à mão: fixture fabricada daria falsa confiança exatamente na parte do sistema que muda sem avisar (Seam 2 da issue #1).

**Estes arquivos são derivados, não capturas integrais.** A estrutura é a capturada; os valores foram minimizados e substituídos. A seção "Derivação" abaixo diz exatamente o quê.

## Procedência

| Arquivo | Origem | Capturado em |
| --- | --- | --- |
| `register-widget.html` | `https://app2.pontomais.com.br/registrar-ponto` | 2026-09-09T11:43:45Z |
| `my-point-table.html` | `https://app2.pontomais.com.br/meu-ponto` | 2026-09-09T11:49:22Z |
| `login-form.html` | `https://app2.pontomais.com.br/login` | 2026-09-09T20:21:32Z |

Coletados pelo console do DevTools na sessão logada, via `outerHTML` do elemento. Inspecionar o DOM não cria Marcação nenhuma.

A captura de `login-form.html` foi feita com Playwright em um contexto novo do Chromium, sem sessão. Abrir `/meu-ponto` redirecionou para `/login`. O arquivo contém o `outerHTML` real de `login-form`, sem alterações de estrutura ou valores. Os campos estavam vazios. Esse componente distingue o login do campo de PIN presente em `register-widget.html`.

## Derivação

A captura crua de `/meu-ponto` continha 32 dias, de 09/08 a 09/09, com 81 Marcações reais, mais saldo de banco de horas, horas extras e horas faltantes. Isso é a rotina diária de uma pessoa por um mês, e o leitor de DOM não precisa dela: o que precisa ser exercido é a estrutura e a **representação** dos horários, não os valores.

O que foi feito, em `my-point-table.html`:

- **29 das 32 linhas de dados removidas.** Sobraram três, escolhidas por serem os casos distintos que o leitor tem de distinguir: um dia em andamento com uma Marcação, um dia sem nenhuma Marcação, e um dia fechado com quatro. O contêiner da grid, o cabeçalho e a estrutura das células estão intactos.
- **Horários, datas e saldo substituídos por valores sintéticos**, mantendo a consistência entre o atributo `title` e o texto visível, que é a propriedade que importa. `aria-rowindex` renumerado para 1–3.

Em `register-widget.html`: o endereço do último registro (Plus Code mais cidade, estado e país) e a data e hora do último registro foram substituídos. Localização e horário reais de pessoa real.

Cada arquivo abre com um comentário HTML repetindo isso, para que a informação viaje com o arquivo.

## O que estas fixtures ensinam

**A lista de Marcações do dia não vive na tela de registro.** `registrar-ponto` mostra apenas um card "Último registro" com data e hora da Marcação mais recente. A Jornada completa está em `/meu-ponto`, outra rota. A issue #1 assume "a lista de Marcações do dia lida na própria página" como fonte de verdade da idempotência — são duas páginas, não uma.

**As Marcações do dia estão no atributo `title`, não no texto visível.** A célula renderiza `<span title="09:02 - 12:07 - 13:11 - 18:04">09:02 -18:04</span>`: o texto visível traz só a primeira e a última. Ler `innerText` devolve 2 de 4 Marcações e faz a extensão concluir que o slot do almoço está vazio — falso negativo que produz Marcação duplicada, que é a única coisa que a Tentativa jamais pode fazer.

**Um dia sem Marcações não é uma célula vazia.** Renderiza o texto `"Nenhum ponto"` com `title=""`. Um leitor que só olhe o `title` e trate string vazia como "não consegui ler" confunde dia vazio com página ilegível — e essas duas observações levam a decisões opostas no módulo de decisão.

**O dia em andamento é identificável.** A coluna de ocorrência traz `pm-icon[title="Expediente em andamento"]` na linha do dia corrente, contra `"Nenhuma ocorrência nesse dia"` nos dias fechados.

**O botão de registrar nasce `disabled`.** No estado capturado, `<button class="pm-button pm-primary" disabled="">`, e o widget exibe "Sua localização expirou!" com um botão "Clique aqui para atualizar a localização". O `disabled` é o portão: achar o botão não basta, a Tentativa tem de verificar se ele está habilitado e tratar a localização expirada como motivo de abortar-e-notificar.

**Os hashes do Angular não devem ser tratados como estáveis.** Os atributos `_ngcontent-ng-c4034245850` e `_nghost-ng-c3789811509` são identificadores de componente gerados no build. As âncoras preferíveis são os custom elements (`vrgente-my-point-table`, `vrgente-address-time-card-register`, `pm-button`), as classes de design system (`pm-button pm-primary`, `dx-data-row`, `date-text`) e os atributos ARIA da grid.

**A grid é DevExpress.** `dx-data-grid#gridContainer`, linhas em `tr.dx-data-row`, colunas endereçadas por `aria-colindex`. Os ids `dx-col-NN` e `dx-<uuid>` são gerados por render. A leitura deve resolver o índice da coluna pelo cabeçalho (`td[aria-label="Coluna Entrada/Saída"]`) e só então aplicar esse índice às linhas de dados — sobrevive a reordenação de coluna, que um índice fixo não sobrevive.

**A célula de data não tem ano, e a ordem das linhas não prova qual dia é hoje.** A célula traz `" ter - 03/03 "`. Compor o ano corrente não prova o período consultado, e a primeira linha não é necessariamente o dia atual: uma página aberta antes da meia-noite continua mostrando a Jornada anterior. O leitor tem de confirmar que a linha corresponde à data pretendida e **abortar quando não conseguir identificar a Jornada inequivocamente** — decidir com a Jornada errada pula uma Marcação necessária ou duplica uma existente.

Na implementação da issue #8, o usuário confirmou que o filtro padrão cobre os últimos 30 dias e autorizou inferir o ano desse intervalo. A extensão abre uma aba nova em `/meu-ponto`, mantém o filtro padrão e busca a data do Gatilho. A inferência usa o calendário local e também cobre a virada do ano. Uma data ausente, fora do intervalo ou repetida impede a leitura.

Os testes usam as capturas como base. Alterações de datas, atributos, colunas e duplicação de elementos são perturbações controladas para testar a inferência e a rejeição de ambiguidades. Esses casos não representam novas capturas do site.

## Lacunas conhecidas

**Falta o estado habilitado do botão.** A captura pegou o botão `disabled` por localização expirada. Presume-se que o estado habilitado difira apenas pela ausência do atributo `disabled`, mas isso não foi observado. Quem implementar o Seam 2 não deve tratar essa presunção como verificada.

**As capturas provam presença, não ausência.** Elas mostram onde os elementos estavam nestas duas rotas, nestes estados, neste dia. Não demonstram que não existam outros estados da mesma rota com marcação diferente.

**A origem da Marcação aparece, mas seu vocabulário não foi mapeado.** A linha traz `pm-icon[title="Inserção por software"]` com ícone `phone_iphone`. Que esse par corresponda especificamente ao aplicativo de celular é leitura plausível, não verificada — os outros valores possíveis desse título não foram observados.

**O reCAPTCHA não atua no registro.** Resolvido pelo HAR de uma Marcação real: a requisição de registro não carrega token de reCAPTCHA, nem em header nem no corpo. Ver `docs/pontomais/register-request.md`, que também documenta a forma da requisição como fallback para quando esta interface mudar.
