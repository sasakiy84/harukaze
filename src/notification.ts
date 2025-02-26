import { getNSecondsAgo, getUnixTime, loadEnv } from './utils.js';
import { MinifluxFeedEntry, readMinifluxEntries } from './miniflux.js';
import { getAllSlackChannels, sendSlackMessage } from './slack.js';
import { KnownBlock } from '@slack/web-api';
import OpenAI from 'openai';

export const FEED_FETCH_INTERVAL_SECOND = 60;

export type PluginDataObject = MinifluxFeedEntry & {
  filtered: boolean;
  additionalMessages: Record<string, string>;
  channelId: string;
}

export type Plugin = (entries: PluginDataObject[]) => Promise<PluginDataObject[]>;

let lastFetchedAt: Date | null = null;
export const fetchFeedsAndNotify = async (plugins: Plugin[] = []) => {
  const changedAfter = lastFetchedAt || getNSecondsAgo(FEED_FETCH_INTERVAL_SECOND);
  const changedBefore = new Date();
  // 新しい　feed を追加したときに、大量の entry が登録される。それら全てが通知されるのを防ぐため、24時間以内に公開されたものだけを通知する
  const publishedAfter =  getNSecondsAgo(60 * 60 * 24);
  const publishedBefore = new Date();

  const getEntryResponse = await readMinifluxEntries({
    changed_after: getUnixTime(changedAfter),
    changed_before: getUnixTime(changedBefore),
    published_after: getUnixTime(publishedAfter),
    published_before: getUnixTime(publishedBefore),
    status: 'unread',
  });
  let feedsForPlugin: PluginDataObject[] = getEntryResponse.entries.map(entry => ({
    ...entry,
    filtered: false,
    additionalMessages: {},
    channelId: '',
  }));

  console.log('Filtered feeds:', feedsForPlugin.map(entry => `${entry.title}, ${entry.url}, ${entry.channelId}, ${entry.created_at}, ${entry.changed_at}`).join('\n'));


  for (const plugin of plugins) {
    feedsForPlugin = await plugin(feedsForPlugin);
  }

  console.log('Feeds:', feedsForPlugin.length);
  console.log('Filtered feeds:', feedsForPlugin.map(entry => `${entry.title}, ${entry.url}, ${entry.channelId}, ${entry.created_at}, ${entry.changed_at}`).join('\n'));

  for (const entry of feedsForPlugin) {
    if (entry.channelId) {
      const blocks: KnownBlock[] = [
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
          fields: [
            {
              type: "mrkdwn",
              text: `*URL:*\n${entry.url}`
            },
            {
              type: "mrkdwn",
              text: `*Category:*\n${entry.feed.category.title}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: entry.content
          }
        },
        {
          type: "divider"
        }
      ];
      await sendSlackMessage(entry.channelId, entry.title, blocks);
    }
  }

  // Update last fetched time only if the fetch was successful
  lastFetchedAt = changedBefore;
};

const OPENAI_API_KEY = loadEnv("OPENAI_API_KEY");
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const determineNotificationChannelPlugin: Plugin = async (entries) => {
  const channels = await getAllSlackChannels();
  if (!channels) {
    console.error('Failed to fetch channels');
    return entries;
  }

  const targetChannels = (channels || []).filter(channel =>
    channel.topic?.value?.includes('for_miniflux_slack_adaptor')
  );

  console.log(`Target channels: ${targetChannels.map(channel => channel.name).join(', ')}`);

  for (const entry of entries) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: 'system',
          content: 'You are a professional journalist who needs to send a news article to a Slack channel. Please select a channel from the list below, and return the channel number.',
        },
        {
          role: 'user',
          content: `<entry>
  <title>${entry.title}</title>
  <url>${entry.url}</url>
  <category>${entry.feed.category.title}</category>
  <content>${entry.content}</content>
</entry>

<channels>
${targetChannels.map((channel, index) => `  <channel number='${index}'>
    <name>${channel.name}</name>
    <topic>${channel.topic?.value ?? 'no topic provided'}</topic>
  </channel>`).join('\n')}
</channels>`,
        },
      ],
    });

    const channel = response.choices[0].message.content;
    const targetChannelNumber = channel ? Number.parseInt(channel) || 0 : 0;
    const matchedChannel = targetChannels[targetChannelNumber] || targetChannels.at(0);
    entry.channelId = matchedChannel?.id ?? entry.channelId;
  }

  return entries;
};
