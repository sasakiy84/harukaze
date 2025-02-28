import { loadEnv } from './utils.js';
import { getAllSlackChannels } from './slack.js';
import type { DataEntry, Plugin, SourceProvider, Notifier, SuccessHandler, ErrorHandler, ResultWithHandler } from './interfaces.js';
import { PluginError } from './interfaces.js';

import OpenAI from 'openai';

export const fetchFeedsAndNotify = async <T, U = T>(sourceProvider: SourceProvider<T>, notifier: Notifier<U>, pluginApplyer: (entries: DataEntry<T>[]) => Promise<ResultWithHandler<DataEntry<U>[]>>) => {
  const successHandlers: SuccessHandler[] = [];
  const errorHandlers: ErrorHandler[] = [];

  try {
    const {
      results: resultsForSourceProvider,
      successHandler: successHandlerForSourceProvider, errorHandler: errorHandlerForSourceProvider
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
      errorHandler: errorHandlerForPluginApplyer
    } = await pluginApplyer(resultsForSourceProvider);

    if (successHandlerForPluginApplyer) {
      successHandlers.push(successHandlerForPluginApplyer);
    }
    if (errorHandlerForPluginApplyer) {
      errorHandlers.push(errorHandlerForPluginApplyer);
    }

    console.log('Feeds:', resultsForPlugin.length);
    console.log('Filtered feeds:', resultsForPlugin.map(entry => `${entry.title}, ${entry.link}, ${entry.targetId}, ${entry.createdAt}, ${entry.updatedAt}`).join('\n'));

    const {
      successHandler: successHandlerForNotifier,
      errorHandler: errorHandlerForNotifier
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
  }
  catch (error) {
    console.error(`Error occurred: ${error}`);
    console.error(`doing ${errorHandlers.length} error handlers`);
    for (const errorHandler of errorHandlers) {
      if (error instanceof Error) {
        await errorHandler(error);
      } else {
        await errorHandler(new Error(`Unknown error occurred: ${error}`));
      }
    }
    console.error('Error handlers done');
  };
}

const OPENAI_API_KEY = loadEnv("OPENAI_API_KEY");
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});



export const determineNotificationChannelPlugin: Plugin = async (entries) => {
  const channels = await getAllSlackChannels();
  if (!channels) {
    console.error('Failed to fetch channels');
    throw new PluginError('Failed to fetch channels');
  }

  const targetChannels = (channels || []).filter(channel =>
    channel.topic?.value?.includes('for_harukaze_notification')
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
  <url>${entry.link}</url>
  <category>${entry.categories.join(', ')}</category>
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
    entry.targetId = matchedChannel?.id ?? entry.targetId;
  }

  const results = entries.map(entry => ({
    ...entry,
    metadata: {
      additionalMessages: entry.metadata?.additionalMessages || []
    }
  }));

  return {
    results: results,
  }
};
