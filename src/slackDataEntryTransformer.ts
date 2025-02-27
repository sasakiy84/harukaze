import type { Plugin } from './interfaces.js';
import type { KnownBlock } from '@slack/web-api';
import type { MinifluxMetadata } from './minifluxSourceProvider.js';

interface SlackMetadata {
    additionalMessages: KnownBlock[];
}

export const TransformerFromMinifluxToSlack: Plugin<MinifluxMetadata, SlackMetadata> = async (entries) => {
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
