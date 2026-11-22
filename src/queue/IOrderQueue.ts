import { Order } from '../domain/Order';

export interface IOrderQueue {
  publish(order: Order): Promise<void>;
}
