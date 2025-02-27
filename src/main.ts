import bolt, { LogLevel } from '@slack/bolt';
import { loadEnv } from './utils.js';
import { fetchFeedsAndNotify, determineNotificationChannelPlugin } from './notification.js';
import { MinifluxSourceProvider } from './minifluxSourceProvider.js';
import { type SlackMetadata, SlackNotifier } from './slackNotifier.js';
import { slackDataEntryTransformer } from './slackDataEntryTransformer.js';
import type { DataEntry } from './interfaces.js';


export const FEED_FETCH_INTERVAL_SECOND = 60;

const sourceProvider = new MinifluxSourceProvider();
const notifier = new SlackNotifier();
const pluginApplyer = async (_entries: DataEntry[]): Promise<DataEntry<SlackMetadata>[]> => {
  return await slackDataEntryTransformer(
    await determineNotificationChannelPlugin(_entries)
  )
};

await fetchFeedsAndNotify(sourceProvider, notifier, pluginApplyer);
setInterval(async () => {
  try {
    await fetchFeedsAndNotify(sourceProvider, notifier, pluginApplyer);
  } catch (error) {
    console.error('Failed to fetch feeds and notify:', error);
  }
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
