# ADR-0002 — Desvio sorteado por Marcação, com deriva na duração da Jornada

Cada horário da Escala sorteia seu próprio desvio, independentemente dos outros. Como consequência, a duração da Jornada varia: com desvio de 15 min sobre 08:30, 12:00, 13:30 e 18:00, o total oscila entre 7h00 e 9h00 contra as 8h00 nominais, e o resíduo acumula no banco de horas. A oscilação é deliberada — a independência entre os sorteios é justamente o que a randomização busca, e preservar o total exigiria correlacioná-los.

## Considered Options

**Sortear livre e ajustar a última Marcação para fechar as 8h00 exatas.** Recusada: a última Marcação deixaria de ser sorteada e passaria a ser calculada, o que devolve o minuto cravado justamente ao fim do dia.

**Aplicar um deslocamento único do dia às quatro Marcações.** Recusada: deixa as quatro correlacionadas por um delta constante, que é o oposto do que a randomização busca.

## Consequences

A oscilação da duração da Jornada é comportamento esperado, não erro de arredondamento. Um teste do módulo de decisão deve fixá-la explicitamente, para que um leitor futuro não a leia como bug e "conserte" a decisão.

Corrigir o banco de horas está fora de escopo: o resíduo é consequência aceita desta decisão, não defeito a compensar.
