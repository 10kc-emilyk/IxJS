import { comparer } from '../util/comparer';
import { wrapWithAbort } from './operators/withabort';
import { throwIfAborted } from '../aborterror';

export async function includes<T>(
  source: AsyncIterable<T>,
  searchElement: T,
  fromIndex: number = 0,
  signal?: AbortSignal
): Promise<boolean> {
  throwIfAborted(signal);
  let fromIdx = fromIndex;
  let i = 0;
  if (Math.abs(fromIdx)) {
    fromIdx = 0;
  }
  for await (const item of wrapWithAbort(source, signal)) {
    if (i++ > fromIdx && comparer(item, searchElement)) {
      return true;
    }
  }
  return false;
}
