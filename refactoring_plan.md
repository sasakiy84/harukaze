# Refactoring Plan

## Define Common Data Transfer Object (DTO)

Create a generic interface `DataEntry<T = Record<string, any>>` with the
following fields:

```typescript
export interface DataEntry<T = Record<string, any>> {
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
```

## Abstract SourceProvider

Create an interface `SourceProvider` with the following method:

```typescript
export interface SourceProvider<T = Record<string, any>> {
    fetchEntries(): Promise<DataEntry<T>[]>;
}
```

Implement `MinifluxSourceProvider` that adheres to `SourceProvider`:

```typescript
import { DataEntry, SourceProvider } from "./interfaces";

export class MinifluxSourceProvider implements SourceProvider {
    async fetchEntries(): Promise<DataEntry[]> {
        // Implementation to fetch entries from Miniflux
    }
}
```

## Abstract Notifier

Create an interface `Notifier` with the following method:

```typescript
export interface Notifier {
    sendNotification(entry: DataEntry): Promise<void>;
}
```

Implement `SlackNotifier` that adheres to `Notifier`:

```typescript
import { DataEntry, Notifier } from "./interfaces";

export class SlackNotifier implements Notifier {
    async sendNotification(entry: DataEntry): Promise<void> {
        // Implementation to send notification to Slack
    }
}
```

## Refactor Plugins

Ensure plugins can work with the new `SourceProvider` and `Notifier`
abstractions:

```typescript
export type Plugin<T = Record<string, any>> = (
    entries: DataEntry<T>[],
) => Promise<DataEntry<T>[]>;
```

## Update Main Application

Use the new abstractions to initialize and run the application:

```typescript
import { MinifluxSourceProvider } from "./minifluxSourceProvider";
import { SlackNotifier } from "./slackNotifier";
import { fetchFeedsAndNotify } from "./notification";
import { Plugin } from "./interfaces";

const sourceProvider = new MinifluxSourceProvider();
const notifier = new SlackNotifier();
const plugins: Plugin[] = [/* your plugins here */];

await fetchFeedsAndNotify(sourceProvider, notifier, plugins);
setInterval(async () => {
    try {
        await fetchFeedsAndNotify(sourceProvider, notifier, plugins);
    } catch (error) {
        console.error("Failed to fetch feeds and notify:", error);
    }
}, FEED_FETCH_INTERVAL_SECOND * 1000);
```
