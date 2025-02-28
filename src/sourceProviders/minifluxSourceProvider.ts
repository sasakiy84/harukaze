import type { SourceProvider } from '../interfaces.js';
import type { MinifluxFeedEntry } from './miniflux.js';
import { readMinifluxEntries } from './miniflux.js';
import { getUnixTime, getNSecondsAgo } from '../utils.js';

export type MinifluxMetadata = Record<string, unknown>;
export class MinifluxSourceProvider implements SourceProvider<MinifluxMetadata> {
    lastFetchTime: Date | null = null;
    async fetchEntries() {
        // 新しく登録された Entry を取得する
        // published で絞り込むと、公開された時間から巡回までに時間がかかっていた場合に、
        // 通知が来ないことが想定される。
        const changedAfter = this.lastFetchTime || getNSecondsAgo(60 * 60 * 1);
        const changedBefore = new Date();
        // changed だけだと、新しい Feed が登録されたときに、大量の通知が来てしまう。
        // それを抑制するために、published で絞り込む。
        const publishedAfter = getNSecondsAgo(60 * 60 * 24);
        const publishedBefore = new Date();

        const getEntryResponse = await readMinifluxEntries({
            changed_after: getUnixTime(changedAfter),
            changed_before: getUnixTime(changedBefore),
            published_after: getUnixTime(publishedAfter),
            published_before: getUnixTime(publishedBefore),
            status: 'unread',
        });

        const results = getEntryResponse.entries.map((entry: MinifluxFeedEntry) => ({
            id: entry.id.toString(),
            title: entry.title,
            link: entry.url,
            content: entry.content,
            author: entry.feed.title,
            createdAt: new Date(entry.published_at),
            updatedAt: new Date(entry.changed_at),
            categories: [entry.feed.category.title],
            metadata: {},
        }));

        console.log(`Fetched ${results.length} entries`);

        const lastFetchTimeForFallback = this.lastFetchTime;
        const errorHandler = async (error: Error) => {
            this.lastFetchTime = lastFetchTimeForFallback;
            console.error(`lastFetchTime is reverted to ${lastFetchTimeForFallback} due to error: ${error}`);
        }
        this.lastFetchTime = changedBefore;

        return {
            results,
            errorHandler,
        };
    }
}
