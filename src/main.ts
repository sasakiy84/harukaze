import bolt, { LogLevel } from '@slack/bolt';

const loadEnv = (envName: string): string => {
  const value = process.env[envName];
  if (value === undefined || value === '') {
    throw new Error(`Environment variable ${envName} is not set.`);
  }
  return value;
};

const main = async () => {
  const SLACK_BOT_TOKEN = loadEnv('SLACK_BOT_TOKEN');
  const SLACK_SIGNING_SECRET = loadEnv('SLACK_SIGNING_SECRET');
  const SLACK_APP_TOKEN = loadEnv('SLACK_APP_TOKEN');

  const boltApp = new bolt.App({
    token: SLACK_BOT_TOKEN,
    signingSecret: SLACK_SIGNING_SECRET,
    logLevel: LogLevel.DEBUG,
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
