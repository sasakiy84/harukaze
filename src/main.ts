import bolt, { LogLevel } from '@slack/bolt';
import { loadEnv } from './utils.js';
import { fetchFeedsAndNotify, determineNotificationChannelPlugin } from './notification.js';
import { type MinifluxMetadata, MinifluxSourceProvider } from './minifluxSourceProvider.js';
import { type SlackMetadata, SlackNotifier } from './slackNotifier.js';
import { TransformerFromMinifluxToSlack } from './slackDataEntryTransformer.js';
import type { DataEntry, ErrorHandler, Plugin, SuccessHandler } from './interfaces.js';


export const FEED_FETCH_INTERVAL_SECOND = 60;

const sourceProvider = new MinifluxSourceProvider();
const notifier = new SlackNotifier();
const pluginApplyer: Plugin<MinifluxMetadata, SlackMetadata> = async (entries: DataEntry[]) => {
  const successHandlers: SuccessHandler[] = [];
  const errorHandlers: ErrorHandler[] = [];

  const { results: resultsForNotificationChannelPlugin, successHandler: successHandlerForNotificationChannelPlugin, errorHandler: errorHandlerForNotificationChannelPlugin } = await determineNotificationChannelPlugin(entries);
  if (successHandlerForNotificationChannelPlugin) {
    successHandlers.push(successHandlerForNotificationChannelPlugin);
  }
  if (errorHandlerForNotificationChannelPlugin) {
    errorHandlers.push(errorHandlerForNotificationChannelPlugin);
  }

  const { results: resultsForSlackDataEntryTransformer, successHandler: successHandlerForSlackDataEntryTransformer, errorHandler: errorHandlerForSlackDataEntryTransformer } = await TransformerFromMinifluxToSlack(resultsForNotificationChannelPlugin);
  if (successHandlerForSlackDataEntryTransformer) {
    successHandlers.push(successHandlerForSlackDataEntryTransformer);
  }
  if (errorHandlerForSlackDataEntryTransformer) {
    errorHandlers.push(errorHandlerForSlackDataEntryTransformer);
  }

  return {
    results: resultsForSlackDataEntryTransformer,
    successHandler: async () => {
      for (const successHandler of successHandlers) {
        await successHandler();
      }
    },
    errorHandler: async (error: Error) => {
      for (const errorHandler of errorHandlers) {
        if (error instanceof Error) {
          await errorHandler(error);
        } else {
          throw new Error('Error handler must be an instance of Error');
        }
      }
    }
  }
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
