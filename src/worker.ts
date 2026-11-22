import 'reflect-metadata';
import 'dotenv/config';
import { createClient } from 'redis';
import { container } from './container/container';
import { Order } from './domain/Order';
import logger from './lib/logger';
import { ORDER_QUEUE } from './queue/RedisOrderQueue';
import { NotificationService } from './services/NotificationService';

async function main() {
  const notification = container.get(NotificationService);

  const redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', (error) => logger.error(`Erro no Redis: ${error.message}`));
  await redis.connect();

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  logger.info(`Worker aguardando pedidos na fila ${ORDER_QUEUE}`);

  while (running) {
    try {
      const message = await redis.brPop(ORDER_QUEUE, 5);
      if (!message) continue;

      const order: Order = JSON.parse(message.element);
      const emailPreview = await notification.orderConfirmed(order);
      logger.info(`Email do pedido #${order.id} enviado: ${emailPreview}`);
    } catch (error: any) {
      logger.error(`Erro ao processar pedido da fila: ${error.message}`);
    }
  }

  await redis.quit();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(`Worker encerrado por erro: ${error.message}`);
    process.exit(1);
  });
