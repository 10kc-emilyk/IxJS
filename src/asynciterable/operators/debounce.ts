import { AbortSignal } from '../../abortsignal';
import { AsyncIterableX } from '../asynciterablex';
import { MonoTypeOperatorAsyncFunction } from '../../interfaces';
import { wrapWithAbort } from './withabort';
import { AbortError } from '../../aborterror';

async function forEach<T>(
  source: AsyncIterable<T>,
  fn: (item: T, signal?: AbortSignal) => void | Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  for await (const item of wrapWithAbort(source, signal)) {
    await fn(item, signal);
  }
}

export class DebounceAsyncIterable<TSource> extends AsyncIterableX<TSource> {
  private _source: AsyncIterable<TSource>;
  private _time: number;

  constructor(source: AsyncIterable<TSource>, time: number) {
    super();
    this._source = source;
    this._time = time;
  }

  async *[Symbol.asyncIterator](signal?: AbortSignal) {
    let noValue: boolean;
    let lastItem: TSource | undefined;
    let deferred: Promise<TSource>;
    let resolver: (value?: TSource | PromiseLike<TSource> | undefined) => void;
    let done: boolean = false;
    let hasError: boolean = false;
    let error: any;
    let handle: any;

    if (signal) {
      signal.onabort = () => {
        clearTimeout(handle);
        hasError = true;
        error = new AbortError();
      };
    }

    const reset = (hasNoValue: boolean) => {
      noValue = hasNoValue;
      lastItem = undefined;
      deferred = new Promise<TSource>((r) => (resolver = r));
    };

    const run = () => {
      if (lastItem === undefined) {
        noValue = true;
        return;
      }

      const item = lastItem;
      const res = resolver;
      reset(false);
      handle = setTimeout(run, this._time);
      res(item);
    };

    reset(true);
    forEach(
      this._source,
      (item) => {
        lastItem = item;
        if (noValue) {
          run();
        }
      },
      signal
    )
      .then(() => (done = true))
      .catch((err) => {
        hasError = true;
        error = err;
      });

    while (1) {
      if (done) {
        break;
      }
      if (hasError) {
        throw error;
      }
      yield await deferred!;
    }
  }
}

export function debounce<TSource>(time: number): MonoTypeOperatorAsyncFunction<TSource> {
  return function debounceOperatorFunction(
    source: AsyncIterable<TSource>
  ): AsyncIterableX<TSource> {
    return new DebounceAsyncIterable<TSource>(source, time);
  };
}
