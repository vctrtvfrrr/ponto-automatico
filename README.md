# Ponto Automático

Extensão do Chrome que registra as Marcações do dia no PontoMais a partir de uma Escala declarada. O vocabulário do domínio está em `CONTEXT.md`; as decisões já tomadas, em `docs/adr/`.

Nesta versão, a extensão guarda a Escala e mostra os Gatilhos de hoje no popup. Cada Gatilho aciona uma Tentativa, que lê a Jornada no PontoMais e salva o resultado no navegador. Ela ainda não registra Marcações.

O botão **Desligar automação** no popup interrompe a automação. O popup mostra **Automação DESLIGADA** e o estado persiste até você clicar em **Ligar automação**, inclusive após reiniciar o navegador. A automação fica ligada por padrão em instalações novas e existentes.

Enquanto a automação está desligada, nenhum dia é planejado. Cada Tentativa consulta o estado salvo, inclusive quando seu Gatilho já estava agendado. Um Gatilho que chega ao próprio horário durante a pausa recebe `disabled`, sem Marcação nem notificação de expiração.

Ao religar, somente os Gatilhos posteriores ao instante da retomada podem prosseguir. Gatilhos anteriores ou simultâneos recebem `disabled`, mesmo dentro da tolerância ou após um reinício. Os horários já sorteados são preservados. Se o dia ainda não tem planejamento, a retomada faz o sorteio.

Com a automação ligada, o primeiro despertar do worker no dia sorteia os Gatilhos e os guarda no navegador. Reabrir o popup ou reiniciar o navegador mantém esses horários. Os horários usam o fuso da máquina.

A extensão cria um alarme por Gatilho e recupera alarmes ausentes quando o worker inicia. Um alarme adicional prepara o próximo dia à meia-noite. Gatilhos pendentes do dia anterior continuam disponíveis para avaliação após um reinício.

A janela começa no instante sorteado e inclui o instante final da tolerância configurada. Dentro dela, a Tentativa abre `/meu-ponto` em segundo plano, sem ativar a aba. Após o fechamento da janela, recebe `expired` e gera uma notificação com o motivo. A extensão grava o resultado antes de notificar e retoma notificações pendentes no próximo despertar.

A leitura espera o carregamento da página e da Jornada por até 45 segundos. A aba fecha ao terminar, com sucesso ou falha. A Jornada lida inclui as Marcações feitas pelo celular ou manualmente, conforme aparecem na tabela. A extensão lê os horários completos do atributo `title`.

O resultado `read` guarda a data e os horários observados em `attempt.decision.workDay`. Ele não confirma uma nova Marcação. A tela de login produz `login-required` e uma notificação para entrar novamente no site. Uma página ilegível ou uma falha de acesso produz `page-unreadable` e uma notificação. A extensão não lê nem armazena credenciais e não faz login automático.

A página usa os últimos 30 dias como filtro padrão. Conforme confirmado pelo usuário na implementação da #8, a extensão infere o ano desse intervalo e mantém os filtros inalterados. A leitura exige uma única linha correspondente à data do Gatilho. Uma Jornada vazia tem uma lista vazia de Marcações; uma Jornada ausente ou ambígua impede a leitura.

O armazenamento local mantém cada Gatilho e sua Tentativa na chave `trigger:AAAA-MM-DD:slot`. Resultados `ready` de versões anteriores permanecem no histórico e não são reprocessados. A tolerância usada é a que está salva nas opções no momento da Tentativa.

Alterações na Escala, no desvio ou nas Exceções após o sorteio valem a partir do dia seguinte. Uma Exceção ou um dia da semana sem horários gera um planejamento vazio, também preservado até o dia seguinte.

## Instalar

```sh
npm install
npm run build
```

Em `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha o diretório `dist/`.

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
