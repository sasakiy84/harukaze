import { getNSecondsAgo, getUnixTime } from './utils.js';
import { MinufluxFeedEntry, readMinifluxEntries } from './miniflux.js';
import { getAllSlackChannels } from './slack.js';

const FEED_FETCH_INTERVAL_SECOND = 60 * 60 * 24;

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

export { fetchFeedsAndNotify, determineNotificationChannelPlugin, Plugin, PluginDataObject, FEED_FETCH_INTERVAL_SECOND };
