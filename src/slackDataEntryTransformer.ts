import type { DataEntry, Plugin } from './interfaces.js';
import type { KnownBlock } from '@slack/web-api';

interface SlackMetadata {
    additionalMessages: KnownBlock[];
}

export const slackDataEntryTransformer: Plugin<Record<string, unknown>, SlackMetadata> = async (entries: DataEntry[]): Promise<DataEntry<SlackMetadata>[]> => {
    return entries.map(entry => ({
        ...entry,
        metadata: {
            additionalMessages: []
        }
    }));
};
