import bolt, { LogLevel } from "@slack/bolt";
import { loadEnv } from "./utils.js";
import { fetchFeedsFromMinifluxAndNotifySlack } from "./minifluSlackAdaptor.js";
import {
  type MinifluxMetadata,
  MinifluxSourceProvider,
} from "./minifluxSourceProvider.js";
import { type SlackMetadata, SlackNotifier } from "./slackNotifier.js";
import { TransformerFromMinifluxToSlack } from "./slackDataEntryTransformer.js";
import type {
  DataEntry,
  ErrorHandler,
  Plugin,
  SuccessHandler,
} from "./interfaces.js";
import { commentatorPluginForSlack } from "./commentatorPlugin.js";
import { determineNotificationChannelPlugin } from "./determineNotificationChannelPlugin.js";

export const FEED_FETCH_INTERVAL_SECOND = 60;

const sourceProvider = new MinifluxSourceProvider();
const notifier = new SlackNotifier();
const pluginApplyer: Plugin<MinifluxMetadata, SlackMetadata> = async (
  entries: DataEntry[],
) => {
  const successHandlers: SuccessHandler[] = [];
  const errorHandlers: ErrorHandler[] = [];

  console.log(`Received ${entries.length} entries`);

  const {
    results: resultsForSlackDataEntryTransformer,
    successHandler: successHandlerForSlackDataEntryTransformer,
    errorHandler: errorHandlerForSlackDataEntryTransformer,
  } = await TransformerFromMinifluxToSlack(entries);
  if (successHandlerForSlackDataEntryTransformer) {
    successHandlers.push(successHandlerForSlackDataEntryTransformer);
  }
  if (errorHandlerForSlackDataEntryTransformer) {
    errorHandlers.push(errorHandlerForSlackDataEntryTransformer);
  }

  const {
    results: resultsForNotificationChannelPlugin,
    successHandler: successHandlerForNotificationChannelPlugin,
    errorHandler: errorHandlerForNotificationChannelPlugin,
  } = await determineNotificationChannelPlugin(
    resultsForSlackDataEntryTransformer,
  );
  if (successHandlerForNotificationChannelPlugin) {
    successHandlers.push(successHandlerForNotificationChannelPlugin);
  }
  if (errorHandlerForNotificationChannelPlugin) {
    errorHandlers.push(errorHandlerForNotificationChannelPlugin);
  }

  const {
    results: resultForCommentatorPluginForSlack,
    successHandler: successHandlerForCommentatorPluginForSlack,
    errorHandler: errorHandlerForCommentatorPluginForSlack,
  } = await commentatorPluginForSlack(resultsForNotificationChannelPlugin);

  if (successHandlerForCommentatorPluginForSlack) {
    successHandlers.push(successHandlerForCommentatorPluginForSlack);
  }
  if (errorHandlerForCommentatorPluginForSlack) {
    errorHandlers.push(errorHandlerForCommentatorPluginForSlack);
  }

  console.log(
    `Transformed ${resultForCommentatorPluginForSlack.length} entries`,
  );

  return {
    results: resultForCommentatorPluginForSlack,
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
          throw new Error("Error handler must be an instance of Error");
        }
      }
    },
  };
};

await fetchFeedsFromMinifluxAndNotifySlack(sourceProvider, notifier, pluginApplyer);
setInterval(async () => {
  try {
    await fetchFeedsFromMinifluxAndNotifySlack(sourceProvider, notifier, pluginApplyer);
  } catch (error) {
    console.error("Failed to fetch feeds and notify:", error);
  }
}, FEED_FETCH_INTERVAL_SECOND * 1000);

const main = async () => {
  const SLACK_BOT_TOKEN = loadEnv("SLACK_BOT_TOKEN");
  const SLACK_SIGNING_SECRET = loadEnv("SLACK_SIGNING_SECRET");
  const SLACK_APP_TOKEN = loadEnv("SLACK_APP_TOKEN");
  const PORT = Number(loadEnv("PORT"));

  const boltApp = new bolt.App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    logLevel: LogLevel.INFO,
    socketMode: true,
    appToken: SLACK_APP_TOKEN,
  });

  boltApp.message("hello", async ({ message, say }) => {
    if (message.subtype !== undefined) {
      return;
    }

    await say(`Hello, <@${message.user}>!`);
  });

  await boltApp.start(PORT);
  console.log(`⚡️ Bolt app is running! (port: ${PORT})`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
