# A requisição de registro de Marcação

Capturada por HAR de uma Marcação real em 2026-09-09T15:00:34Z, na rota `/registrar-ponto`, em resposta à issue #3. Serve como fallback documentado para quando a interface do PontoMais mudar, e como a evidência que responde se o reCAPTCHA atua no registro ou apenas no login.

**Todo valor sensível foi removido.** O HAR cru continha o par `access-token`/`client` da sessão, o `time_clocks_token` da conta da empresa, CPF, NIS, endereço residencial, telefone, `face_id` e e-mails de terceiros. Nada disso é necessário para documentar a forma da requisição, e nada disso está aqui.

## A requisição

```
POST https://api.pontomais.com.br/api/time_cards/register
HTTP/2
```

Note o host: `api.pontomais.com.br`, não `app2.pontomais.com.br`. A permissão de host declarada no manifest cobre apenas `app2`, e é suficiente — a extensão clica o botão e não fala com a API. Chamar a API direto exigiria uma segunda permissão de host.

Headers relevantes:

| Header | Valor |
| --- | --- |
| `access-token` | `<redigido>` |
| `token` | `<redigido — idêntico ao access-token>` |
| `client` | `<redigido>` |
| `uid` | `<e-mail do colaborador>` |
| `uuid` | `<redigido — uuid de dispositivo>` |
| `api-version` | `2` |
| `content-type` | `application/json` |
| `content-length` | `29193` |
| `origin` | `https://app2.pontomais.com.br` |

**Não há nenhum header de reCAPTCHA.**

## O corpo

29.193 bytes. Estrutura de topo:

```json
{
  "image": null,
  "employee": { "<o registro completo do colaborador>": "..." },
  "time_card": {
    "latitude": 0.0,
    "longitude": 0.0,
    "address": "<endereço resolvido>",
    "original_latitude": 0.0,
    "original_longitude": 0.0,
    "original_address": "<endereço resolvido>",
    "location_edited": false,
    "accuracy": 1100,
    "accuracy_method": null,
    "image": null,
    "info": null
  },
  "_path": "/registrar-ponto",
  "_appVersion": "0.10.32",
  "_device": { "manufacturer": "null", "model": "null", "uuid": { "<a resposta inteira do login>": "..." }, "version": "null" }
}
```

**Não há nenhum campo de reCAPTCHA em lugar nenhum do corpo.**

O objeto `employee` não é um id: é o registro inteiro do colaborador como o app o tem em memória — dados cadastrais, endereço, CPF, NIS, foto, equipe, departamento, cargo, centro de custo, a configuração completa de turno com as faixas de hora extra, o histórico de fechamentos mensais com totais de horas, as preferências da conta do cliente e o cadastro da empresa. É de onde vêm quase todos os 29 KB.

O `_device.uuid` não é um uuid: é o objeto de resposta do login, com `token` e `client_id` dentro. O app reenvia a resposta do login a cada Marcação.

## A resposta

```
HTTP/2 202 Accepted
content-type: application/json; charset=utf-8
x-request-id: <redigido>
x-runtime: 0.121567
```

Corpo de 29.643 bytes. Tempo total 647 ms.

## O que isso decide

**O reCAPTCHA não atua na requisição de registro.** Nem header, nem campo no corpo, nem chamada a `grecaptcha.execute` no rastro de inicialização da requisição — que sobe direto de `onClickButton` → `registerTimeCard` → `chooseRegister` → `defaultRegister` → XHR. O script do reCAPTCHA carrega em `/registrar-ponto`, mas carregar a biblioteca não é executar a verificação. Ele atua no login.

**O registro é assíncrono.** `202 Accepted`, não `201 Created`. O servidor aceitou a Marcação para processamento e não afirmou que ela existe. Isso confirma a decisão da issue #1 de confirmar a Marcação relendo a lista do dia: a resposta da requisição não é prova de Marcação registrada, mesmo quando bem-sucedida.

**O payload reforça a decisão do ADR-0001, por um motivo diferente do previsto.** A #1 recusa a alternativa "fetch do service worker replicando o payload" alegando que o Devise Token Auth rotaciona o par `access-token`/`expiry` a cada request, fazendo extensão e aba invalidarem a sessão uma da outra. **Esta captura não mostra rotação:** a resposta não traz `access-token`, `expiry`, `client` nem `uid`, embora o `access-control-expose-headers` os anuncie. Uma amostra única de um endpoint não prova que o sistema nunca rotaciona, mas a justificativa da rotação não está sustentada pela evidência disponível.

O que a evidência sustenta com força é o outro motivo: replicar o payload exige o registro inteiro do colaborador, incluindo a configuração de turno e o histórico de fechamentos. A extensão teria de obter e manter tudo isso sozinha, ou lê-lo da memória do app — que é justamente a dependência de internals que a #1 recusa. Quando o ADR-0001 for escrito na issue #2, é neste ponto que ele deve se apoiar, não na rotação.

## Lacuna

Uma única Marcação capturada, num único dia, com um único método de registro (`Registro Simples`, `time_card_source.id = 2`). Não se sabe se o payload muda quando a conta exige PIN, QR Code ou reconhecimento facial — os três aparecem no DOM do widget e estão fora do escopo da #1, mas vivem no mesmo botão.
