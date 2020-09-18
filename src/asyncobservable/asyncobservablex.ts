import {
  AsyncObservable,
  AsyncObserver,
  AsyncSubscription,
  PartialAsyncObserver,
  SYMBOL_ASYNC_DISPOSABLE,
} from '../interfaces';
import { AsyncObserverX } from './asyncobserverx';

class AutoDetachObserver<T> extends AsyncObserverX<T> {
  private _observer: AsyncObserver<T>;
  private _subscription?: AsyncSubscription;
  private _unsubscribing: boolean = false;
  private _task?: Promise<void>;

  constructor(observer: AsyncObserver<T>) {
    super();
    this._observer = observer;
  }

  async assign(subscription: AsyncSubscription) {
    let shouldUnsubscribe = false;
    if (this._unsubscribing) {
      shouldUnsubscribe = true;
    } else {
      this._subscription = subscription;
    }

    if (shouldUnsubscribe) {
      await this._subscription![SYMBOL_ASYNC_DISPOSABLE]();
    }
  }

  async _next(value: T) {
    if (this._unsubscribing) {
      return;
    }
    this._task = this._observer.next(value);
    try {
      await this._task;
    } finally {
      this._task = undefined;
    }
  }

  async _error(err: any) {
    if (this._unsubscribing) {
      return;
    }
    this._task = this._observer.error(err);
    try {
      await this._task;
    } finally {
      await this._finish();
    }
  }

  async _complete() {
    if (this._unsubscribing) {
      return;
    }
    this._task = this._observer.complete();
    try {
      await this._task;
    } finally {
      await this._finish();
    }
  }

  async [SYMBOL_ASYNC_DISPOSABLE]() {
    let subscription;

    if (!this._unsubscribing) {
      this._unsubscribing = true;
      subscription = this._subscription;
    }

    if (subscription) {
      await subscription[SYMBOL_ASYNC_DISPOSABLE]();
    }
  }

  private async _finish() {
    let subscription;
    if (!this._unsubscribing) {
      this._unsubscribing = true;
      subscription = this._subscription;
    }

    this._task = undefined;

    if (subscription) {
      await subscription[SYMBOL_ASYNC_DISPOSABLE]();
    }
  }
}

export class SafeObserver<T> extends AsyncObserverX<T> {
  private _observer: PartialAsyncObserver<T>;

  constructor(observer: PartialAsyncObserver<T>) {
    super();
    this._observer = observer;
  }

  async _next(value: T) {
    if (this._observer.next) {
      await this._observer.next(value);
    }
  }

  async _error(err: any) {
    if (this._observer.error) {
      await this._observer.error(err);
    } else {
      throw err;
    }
  }

  async _complete() {
    if (this._observer.complete) {
      await this._observer.complete();
    }
  }
}

export abstract class AsyncObservableX<T> implements AsyncObservable<T> {
  async subscribeAsync(observer: PartialAsyncObserver<T>): Promise<AsyncSubscription> {
    const safeObserver = new SafeObserver<T>(observer);
    const autoDetachObserver = new AutoDetachObserver<T>(safeObserver);
    const subscription = await this._subscribeAsync(autoDetachObserver);
    await autoDetachObserver.assign(subscription);
    return autoDetachObserver;
  }

  abstract _subscribeAsync(observer: AsyncObserver<T>): Promise<AsyncSubscription>;
}
