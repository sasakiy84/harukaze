import type { DataEntry, Notifier } from './interfaces.js';
import { sendSlackMessage } from './slack.js';
import type { KnownBlock } from '@slack/web-api';

export interface SlackMetadata {
    additionalMessages: KnownBlock[];
}

export class SlackNotifier implements Notifier<SlackMetadata> {
    async sendNotification(entries: DataEntry<SlackMetadata>[]) {
        for (const entry of entries) {
            if (entry.targetId) {
                await sendSlackMessage(entry.targetId, entry.title, [
                    {
                        type: "header",
                        text: {
                            type: "plain_text",
                            text: `${entry.title}`,
                            emoji: true
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Categories:* ${entry.categories.join(', ')}`
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: entry.author
                        },
                        accessory: {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "View",
                                emoji: true
                            },
                            value: "click_me_123",
                            url: entry.link,
                            action_id: "button-action"
                        }
                    },
                    {
                        type: "divider"
                    },
                    ...(entry.metadata?.additionalMessages || []),
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: entry.link,
                            },
                            {
                                type: "mrkdwn",
                                text: `*Created at:* ${entry.createdAt.toISOString()}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Updated at:* ${entry.updatedAt.toISOString()}`
                            }
                        ]
                    }
                ]);
            }
        }

        return {
            results: true,
        };
    }
}
