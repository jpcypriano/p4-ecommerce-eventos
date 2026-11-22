# E-commerce — Projeto 4

Este é o e-commerce do Projeto 3 já resolvido: API e PostgreSQL em containers, com a rota `GET /orders/:id`. Ele é o ponto de partida deste trabalho. Se você fez o Projeto 3, pode usar o seu código.

## Como rodar

```bash
cp .env.example .env
docker compose up --build
```

A API sobe em `http://localhost:3000`. Teste com:

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "cliente@ethereal.email",
  "items": [{ "productId": 1, "quantity": 1 }],
  "paymentMethod": "pix"
}'
```

---

## Trabalho

Hoje o pedido só responde depois que o e-mail é enviado, e uma falha no e-mail derruba o pedido. Tire o envio de e-mail da API: ela deve publicar o pedido numa fila do Redis, e um **worker**, em outro container, deve ler a fila e enviar o e-mail.

### Já pronto

* O pacote `redis` já está instalado.
* O script `npm run worker`, que executa o `src/worker.ts`.
* O `.env.example`, com o `REDIS_URL` apontando para o serviço `redis`.

### 1. Publique o pedido numa fila

* Crie a interface `IOrderQueue`, com o método `publish(order)`.
* Crie a `RedisOrderQueue`, que implementa a interface e grava o pedido numa lista do Redis com `LPUSH`.
* O `OrderService` deixa de chamar o `NotificationService`. Ele grava o pedido, publica na fila e responde.
* O `OrderService` conhece só a interface. A `RedisOrderQueue` é registrada no `container.ts`.

### 2. Crie o worker

* Crie `src/worker.ts`. Ele lê a fila com `BRPOP` e, para cada pedido, chama o `NotificationService`.
* O worker pega o `NotificationService` do container, como a API faz com o controller.

### 3. Atualize o Compose

* Acrescente o serviço `redis`, **sem porta publicada**.
* Acrescente o serviço `worker`, com o mesmo `Dockerfile` da API e o comando `npm run worker`.

### 4. Escreva um ADR

Crie `docs/adr-001-fila-de-email.md` com três seções: **Contexto**, **Decisão** e **Consequências**. Explique por que usar uma lista do Redis (`LPUSH` / `BRPOP`), e não publish/subscribe.

### Critérios de aceite

1. Clonar, `cp .env.example .env` e `docker compose up --build` sobem tudo sem erro.
2. `POST /orders` responde sem esperar o e-mail. O e-mail aparece no log do worker.
3. Com o worker parado (`docker compose stop worker`), os pedidos esperam na fila. Quando ele volta, os e-mails são enviados.
4. Com dois workers (`docker compose up -d --scale worker=2`), cada pedido é enviado uma vez só.
5. Nenhum arquivo de `services/` ou `controllers/` importa o Redis.
6. O ADR está no repositório.

### Entrega

Pelo git. Informe na caixa de texto do AVA o link do repositório. Ele não pode estar privado: teste antes de entregar.
