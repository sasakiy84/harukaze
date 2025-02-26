import bolt, { LogLevel } from '@slack/bolt';
import { getNSecondsAgo, getUnixTime, loadEnv } from './utils.js';
import { MinufluxFeedEntry, readMinifluxEntries } from './miniflux.js';

const FEED_FETCH_INTERVAL_SECOND = 60 * 60 * 24;
import { getAllSlackChannels } from './slack.js';
import { MinifluxFeed, readMinifluxFeeds } from './miniflux.js';

type PluginDataObject = MinufluxFeedEntry & {
  filtered: boolean;
  additionalMessages: Record<string, string>;
  channelId: string;
}
type Plugin = (feeds: PluginDataObject[]) => Promise<PluginDataObject[]>;

const fetchFeedsAndNotify = async (plugins: Plugin[] = []) => {
    const after = getNSecondsAgo(FEED_FETCH_INTERVAL_SECOND);
    console.log('Fetching feeds after:', after);
    const getEntryResponse = await readMinifluxEntries({
      changed_after: getUnixTime(after),
    });
    let feedsForPlugin: PluginDataObject[] = getEntryResponse.entries.map(entry => ({
        ...entry,
        filtered: false,
        additionalMessages: {},
        channelId: '',
    }));
    for (const plugin of plugins) {
      feedsForPlugin = await plugin(feedsForPlugin);
    }

    console.log('Feeds:', feedsForPlugin.length);
    console.log('Filtered feeds:', feedsForPlugin.map(feed => `${feed.title}, ${feed.url}`).join('\n'));
    
    // TODO: Implement the logic to send notifications to Slack
};

const determineNotificationChannelPlugin: Plugin = async (feeds) => {
  const channels = await getAllSlackChannels();
  if (!channels) {
    console.error('Failed to fetch channels');
    return feeds;
  }

  const targetChannels = (channels || []).filter(channel => 
    channel.topic?.value?.includes('for_miniflux_slack_adaptor')
  );

  console.log(`Target channels: ${targetChannels.map(channel => channel.name).join(', ')}`);

  // Placeholder for LLM API call
  // Example: const response = await fetchLLMResponse(feeds, channels);
  // Process the response to determine the target channel
  return feeds.map(feed => {
    return {
      ...feed,
      channelId: targetChannels[0]?.id ?? feed.channelId,
    };
  });
};

const plugins: Plugin[] = [determineNotificationChannelPlugin];
// Initial fetch and notification
await fetchFeedsAndNotify(plugins);
setInterval(async () => {
  await fetchFeedsAndNotify(plugins);
}, FEED_FETCH_INTERVAL_SECOND * 1000);


const main = async () => {
  const SLACK_BOT_TOKEN = loadEnv('SLACK_BOT_TOKEN');
  const SLACK_SIGNING_SECRET = loadEnv('SLACK_SIGNING_SECRET');
  const SLACK_APP_TOKEN = loadEnv('SLACK_APP_TOKEN');

  const boltApp = new bolt.App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    logLevel: LogLevel.INFO,
    socketMode: true,
    appToken: SLACK_APP_TOKEN,
  });

  boltApp.message('hello', async ({ message, say }) => {
    if (message.subtype !== undefined) {
      return;
    }

    await say(`Hello, <@${message.user}>!`);
  });

  await boltApp.start(3000);
  console.log('⚡️ Bolt app is running!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
