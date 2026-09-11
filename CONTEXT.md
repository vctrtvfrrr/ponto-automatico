# Ponto Automático

Uma extensão do Chrome que registra as Marcações do dia no PontoMais a partir de uma Escala declarada pelo usuário. O código usa o identificador em inglês de cada termo; a prosa, a interface e os documentos usam o termo em português.

## Language

**Marcação** (`Punch`):
Um evento único de registro de ponto aceito pelo PontoMais, com instante e localização. Unidade indivisível: existe ou não existe, e a extensão não tem como alterá-la depois de criada.
_Avoid_: batida, registro, ponto

**Jornada** (`WorkDay`):
O conjunto das Marcações de um único dia, na ordem em que ocorreram.
_Avoid_: dia, expediente, espelho

**Escala** (`Schedule`):
A política declarada pelo usuário: em quais horários, de quais dias da semana, devem existir Marcações. É intenção, nunca histórico.
_Avoid_: agenda, horário, jornada de trabalho

**Gatilho** (`Trigger`):
O compromisso de criar uma Marcação num instante específico, já sorteado. Derivado da Escala, um por horário de cada dia.
_Avoid_: alarme, timer, agendamento

**Tentativa** (`Attempt`):
Uma execução de um Gatilho. Pode terminar sem Marcação, e frequentemente termina — a distinção entre Gatilho e Tentativa separa "estava previsto" de "tentou e não conseguiu".
_Avoid_: execução, disparo, run

**Aviso** (`Alert`):
A mensagem que a extensão emite sobre o desfecho de uma Tentativa. Existe independentemente de onde é entregue, e uma Tentativa emite no máximo um. Nem todo desfecho gera Aviso: o que era previsto e não pediu ação — uma Marcação que já existia na faixa — é silencioso.
_Avoid_: notificação, alerta, push

**Exceção** (`SkipDate`):
Uma data em que nenhum Gatilho existe, cadastrada pelo usuário. Cobre feriado, folga, férias, atestado e recesso indistintamente: o domínio não modela o motivo, apenas a ausência.
_Avoid_: feriado, folga, bloqueio

**Automação** (`Automation`):
O interruptor único do usuário sobre a criação de Marcações. Desligada, nenhum Gatilho existe e nenhuma Tentativa ocorre; ao religar, os Gatilhos cujo instante já passou permanecem sem efeito — a Automação nunca recupera o que ficou para trás.
_Avoid_: extensão, robô, agendador, piloto automático
