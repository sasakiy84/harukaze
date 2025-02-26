import bolt, { LogLevel } from '@slack/bolt';
import { loadEnv } from './utils.js';
import { fetchFeedsAndNotify, determineNotificationChannelPlugin, Plugin, FEED_FETCH_INTERVAL_SECOND } from './notification.js';

const plugins: Plugin[] = [determineNotificationChannelPlugin];
// Initial fetch and notification
await fetchFeedsAndNotify(plugins);
setInterval(async () => {
  await fetchFeedsAndNotify(plugins);
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
