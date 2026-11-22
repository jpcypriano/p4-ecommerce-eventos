# E-commerce — Projeto 4 (fila de e-mail com Redis)

API de pedidos em Node.js/TypeScript com PostgreSQL. O e-mail de confirmação não é mais enviado dentro do `POST /orders`: a API publica o pedido numa fila do Redis e um **worker**, em outro container, envia o e-mail.

## Como rodar

Requisitos: Docker e Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

A API sobe em `http://localhost:3000`. O banco e o Redis ficam só na rede interna do Compose, sem porta publicada.

## Como testar

Crie um pedido:

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{"customer":"cliente@ethereal.email","items":[{"productId":1,"quantity":1}],"paymentMethod":"pix"}'
```

A resposta volta na hora, com `orderId` e `total`. O e-mail aparece no log do worker:

```bash
docker compose logs -f worker
```

Consulte o pedido: `curl http://localhost:3000/orders/1` (404 se não existir).

**Worker parado.** Os pedidos esperam na fila e os e-mails saem quando o worker volta:

```bash
docker compose stop worker
# crie alguns pedidos com o curl acima
docker compose start worker
```

**Dois workers.** Cada pedido é enviado uma única vez:

```bash
docker compose up -d --scale worker=2
```

## Como funciona

```
POST /orders -> OrderService -> grava o pedido -> IOrderQueue.publish() -> responde
                                                        |
                                                  Redis (lista)
                                                        |
                                    worker: BRPOP -> NotificationService -> e-mail
```

| Arquivo | Papel |
|---------|-------|
| `src/queue/IOrderQueue.ts` | Interface da fila (`publish`). É a única que o `OrderService` conhece. |
| `src/queue/RedisOrderQueue.ts` | Implementação: grava o pedido na lista `orders:email` com `LPUSH`. |
| `src/worker.ts` | Lê a lista com `BRPOP` e chama o `NotificationService` para cada pedido. |
| `src/container/container.ts` | Registra a `RedisOrderQueue` como `IOrderQueue`. |
| `compose.yaml` | Serviços `banco`, `redis`, `api` e `worker` (mesmo `Dockerfile` da API). |

Nenhum arquivo de `services/` ou `controllers/` importa o Redis.

## Decisão de arquitetura

O motivo de usar uma lista do Redis (`LPUSH`/`BRPOP`) em vez de publish/subscribe está em [`docs/adr-001-fila-de-email.md`](docs/adr-001-fila-de-email.md).