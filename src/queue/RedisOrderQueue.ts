import { injectable } from 'inversify';
import { createClient } from 'redis';
import logger from '../lib/logger';
import { Order } from '../domain/Order';
import { IOrderQueue } from './IOrderQueue';

export const ORDER_QUEUE = 'orders:email';

@injectable()
export class RedisOrderQueue implements IOrderQueue {
  private client = createClient({ url: process.env.REDIS_URL });
  private connecting?: Promise<unknown>;

  constructor() {
    this.client.on('error', (error) => logger.error(`Erro no Redis: ${error.message}`));
  }

  async publish(order: Order): Promise<void> {
    if (!this.client.isOpen) {
      this.connecting ??= this.client.connect();
      await this.connecting;
    }
    await this.client.lPush(ORDER_QUEUE, JSON.stringify(order));
  }
}
