import { AsyncIterableX } from '../../asynciterable';
import { buffer } from '../../asynciterable/buffer';

export function bufferProto<T>(this: AsyncIterableX<T>, count: number, skip?: number): AsyncIterableX<T[]> {
  return new AsyncIterableX(buffer<T>(this, count, skip));
}

AsyncIterableX.prototype.buffer = bufferProto;

declare module '../../asynciterable' {
  interface AsyncIterableX<T> {
    buffer: typeof bufferProto;
  }
}