export interface DataEntry<T = Record<string, unknown>> {
    id: string;
    title: string;
    link: string;
    content: string;
    author: string;
    createdAt: Date;
    updatedAt: Date;
    categories: string[];
    metadata?: T;
    targetId?: string;
}

export class SourceProviderError extends Error { }
export class NotifierError extends Error { }
export class PluginError extends Error { }

export type SuccessHandler = () => Promise<void>;
export type ErrorHandler = (error: Error) => Promise<void>;
export type ResultWithHandler<T> = {
    results: T,
    successHandler?: SuccessHandler,
    errorHandler?: ErrorHandler,
}

export interface SourceProvider<T = Record<string, unknown>> {
    fetchEntries(): Promise<ResultWithHandler<DataEntry<T>[]>>;
}

export interface Notifier<T = Record<string, unknown>> {
    sendNotification(entries: DataEntry<T>[]): Promise<ResultWithHandler<boolean>>;
}

export type Plugin<T = Record<string, unknown>, U = T> = (
    entries: DataEntry<T>[],
) => Promise<ResultWithHandler<DataEntry<U>[]>>;
