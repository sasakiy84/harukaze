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

export interface SourceProvider<T = Record<string, unknown>> {
    fetchEntries(): Promise<DataEntry<T>[]>;
}

export interface Notifier<T = Record<string, unknown>> {
    sendNotification(entries: DataEntry<T>[]): Promise<void>;
}

export type Plugin<T = Record<string, unknown>, U = T> = (
    entries: DataEntry<T>[],
) => Promise<DataEntry<U>[]>;
