import { WebClient, type ConversationsListResponse, type ChatPostMessageResponse, type KnownBlock } from '@slack/web-api';
import { loadEnv } from '../utils.js';

const token = loadEnv('SLACK_BOT_TOKEN');
const web = new WebClient(token);


export async function getAllSlackChannels(): Promise<ConversationsListResponse['channels']> {
  const result: ConversationsListResponse = await web.conversations.list();
  if (result.ok && result.channels) {
    return result.channels;
  }
  throw new Error('Failed to fetch channels');
}

export async function sendSlackMessage(channelId: string, text: string, blocks: KnownBlock[]): Promise<ChatPostMessageResponse> {
  const result: ChatPostMessageResponse = await web.chat.postMessage({
    channel: channelId,
    text,
    blocks,
  });

  if (!result.ok) {
    throw new Error(`Failed to send message: ${result.error}`);
  }

  return result;
}
