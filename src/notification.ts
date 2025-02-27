import { loadEnv } from './utils.js';
import { getAllSlackChannels } from './slack.js';
import type { DataEntry, Plugin, SourceProvider, Notifier } from './interfaces.js';

import OpenAI from 'openai';

export const fetchFeedsAndNotify = async <T, U = T>(sourceProvider: SourceProvider<T>, notifier: Notifier<U>, pluginApplyer: (entries: DataEntry<T>[]) => Promise<DataEntry<U>[]>) => {
  const entries = await sourceProvider.fetchEntries();
  const pluginAppliedEntries = await pluginApplyer(entries);

  console.log('Feeds:', entries.length);
  console.log('Filtered feeds:', entries.map(entry => `${entry.title}, ${entry.link}, ${entry.targetId}, ${entry.createdAt}, ${entry.updatedAt}`).join('\n'));

  await notifier.sendNotification(pluginAppliedEntries);
};

const OPENAI_API_KEY = loadEnv("OPENAI_API_KEY");
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const determineNotificationChannelPlugin: Plugin = async (entries) => {
  const channels = await getAllSlackChannels();
  if (!channels) {
    console.error('Failed to fetch channels');
    return entries.map(entry => ({
      ...entry,
      metadata: {
        additionalMessages: entry.metadata?.additionalMessages || []
      }
    }));
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

  return entries.map(entry => ({
    ...entry,
    metadata: {
      additionalMessages: entry.metadata?.additionalMessages || []
    }
  }));
};
