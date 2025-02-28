import { loadEnv } from "./utils.js";
import { getAllSlackChannels } from "./slack.js";
import type { Plugin } from "./interfaces.js";
import { PluginError } from "./interfaces.js";

import OpenAI from "openai";
import type { SlackMetadata } from "./slackNotifier.js";

const OPENAI_API_KEY = loadEnv("OPENAI_API_KEY");
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export const determineNotificationChannelPlugin: Plugin<SlackMetadata> = async (
  entries,
) => {
  const channels = await getAllSlackChannels();
  if (!channels) {
    console.error("Failed to fetch channels");
    throw new PluginError("Failed to fetch channels");
  }

  const targetChannels = (channels || []).filter((channel) =>
    channel.topic?.value?.includes("for_harukaze_notification"),
  );

  console.log(
    `Target channels: ${targetChannels.map((channel) => channel.name).join(", ")}`,
  );

  for (const entry of entries) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional journalist who needs to send a news article to a Slack channel. Please select a channel from the list below, and return the channel number.",
        },
        {
          role: "user",
          content: `<entry>
    <title>${entry.title}</title>
    <url>${entry.link}</url>
    <category>${entry.categories.join(", ")}</category>
    <content>${entry.content}</content>
  </entry>
  
  <channels>
  ${targetChannels
              .map(
                (channel, index) => `  <channel number='${index}'>
      <name>${channel.name}</name>
      <topic>${channel.topic?.value ?? "no topic provided"}</topic>
    </channel>`,
              )
              .join("\n")}
  </channels>`,
        },
      ],
    });

    const channel = response.choices[0].message.content;
    const targetChannelNumber = channel ? Number.parseInt(channel) || 0 : 0;
    const matchedChannel =
      targetChannels[targetChannelNumber] || targetChannels.at(0);
    entry.targetId = matchedChannel?.id ?? entry.targetId;
  }

  const results = entries.map((entry) => ({
    ...entry,
    metadata: {
      additionalMessages: entry.metadata?.additionalMessages || [],
    },
  }));

  return {
    results: results,
  };
};
