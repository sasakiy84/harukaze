import type { DataEntry, Notifier } from './interfaces.js';
import { sendSlackMessage } from './slack.js';
import type { KnownBlock } from '@slack/web-api';

export interface SlackMetadata {
    additionalMessages: KnownBlock[];
}

const dateFormatter = Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
});

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
                                text: `:art: categories: ${entry.categories.join(", ")}`,
                            },
                        ]
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: `:link: ${entry.link}`,
                            }
                        ]
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: `:spiral_calendar_pad: *Created at:* ${dateFormatter.format(entry.createdAt)}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Updated at:* ${dateFormatter.format(entry.updatedAt)}`
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
