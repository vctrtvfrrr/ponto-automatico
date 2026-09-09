# Ponto Automático

Extensão do Chrome que registra as Marcações do dia no PontoMais a partir de uma Escala declarada. O vocabulário do domínio está em `CONTEXT.md`; as decisões já tomadas, em `docs/adr/`.

A extensão guarda a Escala e mostra os Gatilhos e as Marcações de hoje no popup. Cada Gatilho aciona uma Tentativa. Ela consulta a Jornada, clica o botão real do PontoMais quando necessário e relê a Jornada para confirmar a Marcação.

O botão **Desligar automação** no popup interrompe a automação. O popup mostra **Automação DESLIGADA** e o estado persiste até você clicar em **Ligar automação**, inclusive após reiniciar o navegador. A automação fica ligada por padrão em instalações novas e existentes.

Enquanto a automação está desligada, nenhum dia é planejado. Cada Tentativa consulta o estado salvo, inclusive quando seu Gatilho já estava agendado. Um Gatilho que chega ao próprio horário durante a pausa recebe `disabled`, sem Marcação nem notificação de expiração.

Ao religar, somente os Gatilhos posteriores ao instante da retomada podem prosseguir. Gatilhos anteriores ou simultâneos recebem `disabled`, mesmo dentro da tolerância ou após um reinício. Os horários já sorteados são preservados. Se o dia ainda não tem planejamento, a retomada faz o sorteio.

Com a automação ligada, o primeiro despertar do worker no dia sorteia os Gatilhos e os guarda no navegador. Reabrir o popup ou reiniciar o navegador mantém esses horários. Os horários usam o fuso da máquina.

A extensão cria um alarme por Gatilho e recupera alarmes ausentes quando o worker inicia. Um alarme adicional prepara o próximo dia à meia-noite. Gatilhos pendentes do dia anterior continuam disponíveis para avaliação após um reinício.

A janela de tolerância começa no instante sorteado e inclui seu limite final. Após esse limite, a Tentativa recebe `expired` e notifica o motivo. O content script consulta novamente a tolerância e o estado da automação imediatamente antes do clique. A extensão grava o resultado antes de notificar e retoma notificações pendentes no próximo despertar.

A Tentativa abre `/registrar-ponto` em segundo plano e espera o botão por até 45 segundos. Em seguida, abre uma nova aba em `/meu-ponto` e espera a Jornada por até 45 segundos. As abas não recebem o foco e fecham ao terminar, com sucesso ou falha. A leitura usa o DOM disponível, sem esperar todos os recursos secundários. Ela inclui as Marcações feitas pelo celular ou manualmente, conforme aparecem na tabela. Os horários completos vêm do atributo `title`.

A Tentativa reconhece uma Marcação dentro da faixa do horário nominal da Escala, com o mesmo desvio usado no sorteio. Os dois limites estão incluídos. Por exemplo, 13:30 com desvio de 15 minutos aceita qualquer Marcação entre 13:15 e 13:45. Uma Marcação nessa faixa produz `already-filled`, sem clique, mesmo quando falta uma Marcação anterior. A faixa fica salva junto do Gatilho. Alterar a Escala depois do sorteio não altera essa faixa. Com desvio zero, somente o minuto nominal corresponde ao horário da Escala.

Antes de abrir as páginas, a extensão grava a Tentativa. Assim, um reinício do worker não repete o clique. Uma Tentativa interrompida gera uma notificação para conferir a Jornada antes de marcar manualmente. A leitura anterior ao clique pode ter no máximo dois segundos. Uma leitura mais antiga produz `stale-observation`, sem clique. A mudança da data durante a Tentativa também impede o clique.

Depois do clique único, a extensão mantém a página de registro aberta e consulta novas cópias de `/meu-ponto` por até 60 segundos. Entre consultas, espera até dois segundos. A confirmação exige uma nova Marcação a partir do minuto do clique, com as Marcações anteriores preservadas na lista. Uma nova Marcação produz `confirmed`. A ausência de confirmação produz `unconfirmed` e uma notificação. Uma resposta perdida ao comando de clique também inicia a confirmação, sem repetir o comando. A extensão nunca tenta preencher um horário passado.

A tela de login produz `login-required`. Uma Jornada ilegível produz `page-unreadable`. Um botão ausente ou ambíguo produz `button-missing`; um botão desabilitado produz `button-disabled`. Esses resultados geram notificações. A extensão não lê credenciais, não faz login automático e não habilita o botão à força. Ela não fabrica coordenadas nem seleciona a localização de uma Marcação anterior. O próprio PontoMais obtém a localização e envia a Marcação.

A Tentativa guarda a última Jornada observada em `attempt.workDay`. O popup consulta a Jornada ao abrir, mostra todas as Marcações e informa o horário da última leitura. O botão **Atualizar Marcações** faz uma nova consulta. Essa leitura também funciona com a automação desligada e não cria Marcações. Se a consulta falhar, o popup mantém a última leitura de hoje e mostra a falha.

A página usa os últimos 30 dias como filtro padrão. Conforme confirmado pelo usuário na implementação da #8, a extensão infere o ano desse intervalo e mantém os filtros inalterados. A leitura exige uma única linha correspondente à data do Gatilho. Uma Jornada vazia tem uma lista vazia de Marcações; uma Jornada ausente ou ambígua impede a leitura.

O armazenamento local mantém cada Gatilho e sua Tentativa na chave `trigger:AAAA-MM-DD:slot`. Resultados `ready` e `read` de versões anteriores permanecem no histórico e não são reprocessados. Gatilhos antigos sem faixa de reconhecimento recebem `schedule-unavailable` e notificam, sem clique. O planejamento do próximo dia salva as faixas automaticamente. A tolerância usada é a que está salva nas opções no momento da Tentativa.

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
