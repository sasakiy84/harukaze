import type {
  DataEntry,
  SourceProvider,
  Notifier,
  SuccessHandler,
  ErrorHandler,
  ResultWithHandler,
} from "./interfaces.js";
import { sendSlackMessage } from "./notifiers/slack.js";

export const fetchFeedsFromMinifluxAndNotifySlack = async <T, U = T>(
  sourceProvider: SourceProvider<T>,
  notifier: Notifier<U>,
  pluginApplyer: (
    entries: DataEntry<T>[],
  ) => Promise<ResultWithHandler<DataEntry<U>[]>>,
) => {
  const successHandlers: SuccessHandler[] = [];
  const errorHandlers: ErrorHandler[] = [];

  try {
    const {
      results: resultsForSourceProvider,
      successHandler: successHandlerForSourceProvider,
      errorHandler: errorHandlerForSourceProvider,
    } = await sourceProvider.fetchEntries();
    if (successHandlerForSourceProvider) {
      successHandlers.push(successHandlerForSourceProvider);
    }
    if (errorHandlerForSourceProvider) {
      errorHandlers.push(errorHandlerForSourceProvider);
    }

    const {
      results: resultsForPlugin,
      successHandler: successHandlerForPluginApplyer,
      errorHandler: errorHandlerForPluginApplyer,
    } = await pluginApplyer(resultsForSourceProvider);

    if (successHandlerForPluginApplyer) {
      successHandlers.push(successHandlerForPluginApplyer);
    }
    if (errorHandlerForPluginApplyer) {
      errorHandlers.push(errorHandlerForPluginApplyer);
    }

    console.log("Feeds:", resultsForPlugin.length);
    console.log(
      "Filtered feeds:",
      resultsForPlugin
        .map(
          (entry) =>
            `${entry.title}, ${entry.link}, ${entry.targetId}, ${entry.createdAt}, ${entry.updatedAt}`,
        )
        .join("\n"),
    );

    const {
      successHandler: successHandlerForNotifier,
      errorHandler: errorHandlerForNotifier,
    } = await notifier.sendNotification(resultsForPlugin);

    if (successHandlerForNotifier) {
      successHandlers.push(successHandlerForNotifier);
    }
    if (errorHandlerForNotifier) {
      errorHandlers.push(errorHandlerForNotifier);
    }

    for (const successHandler of successHandlers) {
      await successHandler();
    }
  } catch (error) {
    console.error(`Error occurred: ${error}`);
    console.error(`doing ${errorHandlers.length} error handlers`);
    for (const errorHandler of errorHandlers) {
      if (error instanceof Error) {
        try {
          await errorHandler(error);
        } catch (error) {
          console.error(`Error handler failed: ${error}`);
        }
      } else {
        try {
          await errorHandler(
            new Error("Error handler must be an instance of Error"),
          );
        } catch (error) {
          console.error(`Error handler failed: ${error}`);
        }
      }
    }
    console.error("Error handlers done");

    try {
      await sendSlackMessage(
        process.env.SLACK_ERROR_CHANNEL_ID || "C08FB6XER0E",
        `Error occurred while fetchFeedFromMinifluxAndNotifySlack: ${error}`,
        [],
      );
      if (error instanceof Error) {
        await sendSlackMessage(
          process.env.SLACK_ERROR_CHANNEL_ID || "C08FB6XER0E",
          `Error message: \n\`\`\`\n${error.stack}\`\`\``,
          [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: error.stack ? `\`\`\`\n${error.stack}\`\`\`` : "",
              },
            }
          ],
        );
      }
    } catch (error) {
      console.error(`Failed to send error message: ${error}`);

    }
  }
};
