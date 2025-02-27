import type { Plugin } from './interfaces.js';
import type { KnownBlock } from '@slack/web-api';

interface SlackMetadata {
    additionalMessages: KnownBlock[];
}

export const slackDataEntryTransformer: Plugin<Record<string, unknown>, SlackMetadata> = async (entries) => {
    const results = entries.map(entry => ({
        ...entry,
        metadata: {
            additionalMessages: []
        }
    }));

    return {
        results: results,
    }
};
