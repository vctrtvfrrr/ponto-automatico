# Ponto Automático

Extensão do Chrome que registra as Marcações do dia no PontoMais a partir de uma Escala declarada. O vocabulário do domínio está em `CONTEXT.md`; as decisões já tomadas, em `docs/adr/`.

A extensão guarda a Escala e mostra os Gatilhos e as Marcações de hoje no popup, numa lista única conciliada. Cada Gatilho aciona uma Tentativa. Ela consulta a Jornada, clica o botão real do PontoMais quando necessário e relê a Jornada para confirmar a Marcação.

O interruptor no cabeçalho do popup liga e desliga a automação, e o seu rótulo diz o estado atual. O estado persiste até você tocá-lo de novo, inclusive após reiniciar o navegador. A automação fica ligada por padrão em instalações novas e existentes. Com ela desligada, o popup não mostra Gatilho nenhum — desligada, nenhum existe —, e as Marcações de hoje continuam na lista.

Enquanto a automação está desligada, nenhum dia é planejado. Cada Tentativa consulta o estado salvo, inclusive quando seu Gatilho já estava agendado. Um Gatilho que chega ao próprio horário durante a pausa recebe `disabled`, sem Marcação nem Aviso de expiração.

Ao religar, somente os Gatilhos posteriores ao instante da retomada podem prosseguir. Gatilhos anteriores ou simultâneos recebem `disabled`, mesmo dentro da tolerância ou após um reinício. Os horários já sorteados são preservados. Se o dia ainda não tem planejamento, a retomada faz o sorteio.

Com a automação ligada, o primeiro despertar do worker no dia sorteia os Gatilhos e os guarda no navegador. Reabrir o popup ou reiniciar o navegador mantém esses horários. Os horários usam o fuso da máquina.

A extensão cria um alarme por Gatilho e recupera alarmes ausentes quando o worker inicia. Um alarme adicional prepara o próximo dia à meia-noite. Gatilhos pendentes do dia anterior continuam disponíveis para avaliação após um reinício.

A janela de tolerância começa no instante sorteado e inclui seu limite final. Após esse limite, a Tentativa recebe `expired` e o Aviso diz o motivo. O content script consulta novamente a tolerância e o estado da automação imediatamente antes do clique. A extensão grava o resultado antes de emitir o Aviso e retoma os Avisos pendentes no próximo despertar.

A Tentativa abre `/registrar-ponto` em segundo plano e espera o botão por até 45 segundos. Em seguida, abre uma nova aba em `/meu-ponto` e espera a Jornada por até 45 segundos. As abas não recebem o foco e fecham ao terminar, com sucesso ou falha. A leitura usa o DOM disponível, sem esperar todos os recursos secundários. Ela inclui as Marcações feitas pelo celular ou manualmente, conforme aparecem na tabela. Os horários completos vêm do atributo `title`.

A Tentativa reconhece uma Marcação dentro da faixa do horário nominal da Escala, com o mesmo desvio usado no sorteio. Os dois limites estão incluídos. Por exemplo, 13:30 com desvio de 15 minutos aceita qualquer Marcação entre 13:15 e 13:45. Uma Marcação nessa faixa produz `already-filled`, sem clique, mesmo quando falta uma Marcação anterior. A faixa fica salva junto do Gatilho. Alterar a Escala depois do sorteio não altera essa faixa. Com desvio zero, somente o minuto nominal corresponde ao horário da Escala.

Antes de abrir as páginas, a extensão grava a Tentativa. Assim, um reinício do worker não repete o clique. Uma Tentativa interrompida gera um Aviso para conferir a Jornada antes de marcar manualmente. A leitura anterior ao clique pode ter no máximo dois segundos. Uma leitura mais antiga produz `stale-observation`, sem clique. A mudança da data durante a Tentativa também impede o clique.

Depois do clique único, a extensão mantém a página de registro aberta e consulta novas cópias de `/meu-ponto` por até 60 segundos. Entre consultas, espera até dois segundos. A confirmação exige uma nova Marcação a partir do minuto do clique, com as Marcações anteriores preservadas na lista. Uma nova Marcação produz `confirmed`. A ausência de confirmação produz `unconfirmed` e um Aviso. Uma resposta perdida ao comando de clique também inicia a confirmação, sem repetir o comando. A extensão nunca tenta preencher um horário passado.

A tela de login produz `login-required`. Uma Jornada ilegível produz `page-unreadable`. Um botão ausente ou ambíguo produz `button-missing`; um botão desabilitado produz `button-disabled`. Esses resultados geram Avisos. A extensão não lê credenciais, não faz login automático e não habilita o botão à força. Ela não fabrica coordenadas nem seleciona a localização de uma Marcação anterior. O próprio PontoMais obtém a localização e envia a Marcação.

Cada Tentativa emite no máximo um Aviso. O sucesso também fala: uma Marcação confirmada gera **Marcação registrada às HH:MM**, com o horário que apareceu na Jornada, não o do Gatilho — os dois diferem por até alguns minutos. Uma Marcação que já existia na faixa de reconhecimento é silenciosa, assim como um Gatilho que chega com a automação desligada.

Todo Aviso sai em dois canais independentes: o navegador, que o mostra na área de notificações do Chrome, e um push no `ntfy.sh`, recebido no celular pelo app do ntfy. O fracasso chega com prioridade `urgent` e a tag `warning`; o sucesso, com prioridade `low` e a tag `white_check_mark`. Tocar no push abre a Jornada no PontoMais.

Configure o tópico em **Opções**, na seção **Avisos**. Quando não há tópico salvo, o campo já vem com uma sugestão sorteada; copie o nome para o app do ntfy uma única vez. O nome do tópico é a senha — quem o conhece lê seus horários —, por isso a sugestão é sorteada em vez de escolhida à mão. O campo inteiro é editável, prefixo incluído, e aceita de 1 a 64 caracteres entre letras, números, hífen e sublinhado. Deixar o campo vazio desliga o push, sem erro. A Escala e o tópico são salvos pelo mesmo botão, numa única gravação.

Os dois canais entregam e se recuperam separadamente, cada um com seu próprio marcador. Um push que não saiu é tentado de novo no próximo despertar da extensão, mas somente enquanto o Gatilho é de hoje: depois da virada do dia ele não é mais tentado, e o Aviso do navegador sai do mesmo jeito. Uma falha de push segura os demais por cinco minutos, para não esbarrar no limite de requisições do `ntfy.sh`, e cada envio cancela em dez segundos para não atrasar a Tentativa seguinte. As decisões desse canal estão em `docs/adr/0003-push-de-avisos-pelo-ntfy.md`. A extensão não pede nenhuma permissão nova do Chrome para empurrá-lo.

Atualizar a extensão não anuncia o passado. Os Gatilhos gravados por versões anteriores continuam no armazenamento: uma Marcação confirmada por elas não tem o horário que o Aviso de sucesso informa e permanece silenciosa, como era quando aconteceu, e um fracasso ainda não avisado continua chegando ao navegador.

A Tentativa guarda a última Jornada observada em `attempt.workDay`. O popup consulta a Jornada ao abrir e informa o horário da última leitura no rodapé da lista. O botão **Atualizar** faz uma nova consulta. Essa leitura também funciona com a automação desligada e não cria Marcações. Se a consulta falhar, o popup mantém a última leitura de hoje e mostra a falha.

O popup deriva o desfecho de cada Gatilho por conta própria, sem a Tentativa: percorrendo os Gatilhos em ordem cronológica, cada um reivindica a primeira Marcação ainda não atribuída entre o início da sua faixa e o seu horário mais a tolerância. Nenhuma Marcação é reivindicada duas vezes, um Gatilho sem faixa não concilia e as Marcações que sobram aparecem na lista rotuladas. A faixa é estendida pela tolerância porque o alarme do Chrome atrasa com o navegador ocioso, e uma Marcação bem-sucedida nasce com frequência depois do fim da faixa. Um desfecho negativo exige evidência: sem uma leitura da Jornada posterior ao momento em questão, a linha diz apenas **sem leitura**, nunca **falhou**. A tolerância usada na conciliação é a que está salva nas opções agora, então alterá-la também muda como o popup lê o dia que já passou. O ADR-0004 registra a decisão e as suas consequências.

A página usa os últimos 30 dias como filtro padrão. Conforme confirmado pelo usuário na implementação da #8, a extensão infere o ano desse intervalo e mantém os filtros inalterados. A leitura exige uma única linha correspondente à data do Gatilho. Uma Jornada vazia tem uma lista vazia de Marcações; uma Jornada ausente ou ambígua impede a leitura.

O armazenamento local mantém cada Gatilho e sua Tentativa na chave `trigger:AAAA-MM-DD:slot`. Resultados `ready` e `read` de versões anteriores permanecem no histórico e não são reprocessados. Gatilhos antigos sem faixa de reconhecimento recebem `schedule-unavailable` e geram Aviso, sem clique. O planejamento do próximo dia salva as faixas automaticamente. A tolerância usada é a que está salva nas opções no momento da Tentativa.

Alterações na Escala, no desvio ou nas Exceções após o sorteio valem a partir do dia seguinte. Uma Exceção ou um dia da semana sem horários gera um planejamento vazio, também preservado até o dia seguinte.

## Instalar

```sh
npm install
npm run build
```

Em `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha o diretório `dist/`.

Antes de usar a automação, entre em `https://app2.pontomais.com.br` e permita que **o site acesse sua localização** nas configurações do Chrome. A permissão de localização do site é um pré-requisito da instalação. Confira em `/registrar-ponto` que a localização está válida e o botão de Marcação está habilitado.

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
