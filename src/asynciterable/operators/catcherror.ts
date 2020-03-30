import { AsyncIterableX } from '../asynciterablex';
import { OperatorAsyncFunction } from '../../interfaces';
import { returnAsyncIterator } from '../../util/returniterator';
import { wrapWithAbort } from './withabort';
import { throwIfAborted } from '../../aborterror';

export class CatchWithAsyncIterable<TSource, TResult> extends AsyncIterableX<TSource | TResult> {
  private _source: AsyncIterable<TSource>;
  private _handler: (
    error: any,
    signal?: AbortSignal
  ) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

  constructor(
    source: AsyncIterable<TSource>,
    handler: (
      error: any,
      signal?: AbortSignal
    ) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>
  ) {
    super();
    this._source = source;
    this._handler = handler;
  }

  async *[Symbol.asyncIterator](signal?: AbortSignal) {
    throwIfAborted(signal);
    let err: AsyncIterable<TResult> | undefined;
    let hasError = false;
    const source = wrapWithAbort(this._source, signal);
    const it = source[Symbol.asyncIterator]();
    while (1) {
      let c = <IteratorResult<TSource>>{};

      try {
        c = await it.next();
        if (c.done) {
          await returnAsyncIterator(it);
          break;
        }
      } catch (e) {
        err = await this._handler(e, signal);
        hasError = true;
        await returnAsyncIterator(it);
        break;
      }

      yield c.value;
    }

    if (hasError) {
      for await (const item of wrapWithAbort(err!, signal)) {
        yield item;
      }
    }
  }
}

/**
 * Continues an async-iterable sequence that is terminated by an exception with the
 * async-iterable sequence produced by the handler.
 * @param handler Error handler function, producing another async-iterable sequence.
 */
export function catchError<TSource, TResult>(
  handler: (
    error: any,
    signal?: AbortSignal
  ) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>
): OperatorAsyncFunction<TSource, TSource | TResult> {
  return function catchWithOperatorFunction(
    source: AsyncIterable<TSource>
  ): AsyncIterableX<TSource | TResult> {
    return new CatchWithAsyncIterable<TSource, TResult>(source, handler);
  };
}
