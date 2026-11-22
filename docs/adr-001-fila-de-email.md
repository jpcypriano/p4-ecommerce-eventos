# ADR 001 — Fila de e-mail com lista do Redis

## Contexto

Até aqui, o `OrderService` chamava o `NotificationService` dentro do `POST /orders`. Isso causava dois problemas:

- O cliente só recebia a resposta depois que o e-mail era enviado, então um provedor de e-mail lento deixava o pedido lento.
- Uma falha no envio do e-mail derrubava a requisição, mesmo com o pedido já gravado no banco e o pagamento já processado.

O envio de e-mail não precisa acontecer dentro da requisição. Ele só precisa acontecer, uma única vez para cada pedido, mesmo que o sistema de e-mail esteja fora do ar por um tempo ou que existam vários processos enviando e-mails ao mesmo tempo.

## Decisão

A API deixa de enviar e-mail. Depois de gravar o pedido, ela o publica numa fila e responde na hora. Um **worker**, em outro container, lê a fila e chama o `NotificationService`.

A fila é uma **lista do Redis**: a API insere o pedido com `LPUSH` e o worker retira com `BRPOP`. Escolhemos a lista, e não o publish/subscribe (`PUBLISH` / `SUBSCRIBE`), pelos motivos abaixo:

- **A mensagem espera.** Numa lista, o pedido fica guardado no Redis até alguém retirá-lo. No publish/subscribe a mensagem só chega a quem está inscrito no momento; com o worker parado, ela se perde e o e-mail nunca é enviado.
- **Cada pedido vai para um único worker.** O `BRPOP` retira o elemento de forma atômica, então, com vários workers lendo a mesma lista, cada pedido é entregue a apenas um deles. No publish/subscribe, todos os inscritos recebem todas as mensagens, e com dois workers o cliente receberia dois e-mails.
- **Espera sem consumir CPU.** O `BRPOP` bloqueia até chegar um item, sem precisar consultar a fila de tempos em tempos.

No código, o `OrderService` conhece só a interface `IOrderQueue`; a `RedisOrderQueue` é registrada no `container.ts`. Assim, nenhum arquivo de `services/` ou `controllers/` importa o Redis, e a tecnologia da fila pode ser trocada mexendo apenas na implementação e no container.

## Consequências

**Positivas**

- `POST /orders` responde sem esperar o e-mail, e uma falha no envio não derruba mais o pedido.
- Com o worker parado, os pedidos se acumulam na fila e os e-mails são enviados quando ele volta.
- Para enviar mais e-mails em paralelo, basta subir mais workers (`docker compose up -d --scale worker=2`), sem mudar código.

**Negativas e limites**

- A lista não tem confirmação de recebimento: o pedido sai da fila assim que o worker o retira. Se o worker cair depois do `BRPOP` e antes de enviar o e-mail, ou se o envio falhar, aquele e-mail se perde. O worker apenas registra o erro no log e segue para o próximo pedido, sem nova tentativa (entrega *no máximo uma vez*).
- O Redis do Compose não tem volume. Se o container do Redis for recriado, os pedidos que ainda estavam na fila são perdidos.
- Há mais uma peça para operar (o Redis) e mais um processo para monitorar (o worker).
- O e-mail passa a ser enviado de forma assíncrona: o cliente pode receber a resposta do pedido antes do e-mail.

Se essas garantias se tornarem insuficientes, o próximo passo seria uma ferramenta com confirmação e reenvio, como Redis Streams com grupos de consumidores ou um broker como o RabbitMQ.
