import type { SourceProvider } from './interfaces.js';
import type { MinifluxFeedEntry } from './miniflux.js';
import { readMinifluxEntries } from './miniflux.js';
import { getUnixTime, getNSecondsAgo } from './utils.js';


export class MinifluxSourceProvider implements SourceProvider {
    lastFetchTime: Date | null = null;
    async fetchEntries() {
        const changedAfter = this.lastFetchTime || getNSecondsAgo(60 * 60 * 3);
        const changedBefore = new Date();
        const publishedAfter = getNSecondsAgo(60 * 60 * 24);
        const publishedBefore = new Date();

        const getEntryResponse = await readMinifluxEntries({
            changed_after: getUnixTime(changedAfter),
            changed_before: getUnixTime(changedBefore),
            published_after: getUnixTime(publishedAfter),
            published_before: getUnixTime(publishedBefore),
            status: 'unread',
        });

        this.lastFetchTime = changedBefore;

        const results = getEntryResponse.entries.map((entry: MinifluxFeedEntry) => ({
            id: entry.id.toString(),
            title: entry.title,
            link: entry.url,
            content: entry.content,
            author: entry.feed.title,
            createdAt: new Date(entry.created_at),
            updatedAt: new Date(entry.changed_at),
            categories: [entry.feed.category.title],
            metadata: {},
        }));

        return {
            results
        };
    }
}
