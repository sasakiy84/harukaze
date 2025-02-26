import { WebClient, ConversationsListResponse } from '@slack/web-api';
import { loadEnv } from './utils';

const token = loadEnv('SLACK_TOKEN');
const web = new WebClient(token);

export async function getAllSlackChannels(): Promise<ConversationsListResponse['channels']> {
  const result: ConversationsListResponse = await web.conversations.list();
  if (result.ok && result.channels) {
    return result.channels;
  } else {
    throw new Error('Failed to fetch channels');
  }
}
