import { loadEnv } from './utils.js';
import type { Plugin, DataEntry } from './interfaces.js';
import type { SlackMetadata } from './slackNotifier.js';
import OpenAI from 'openai';
import type { KnownBlock } from '@slack/web-api';
import type { ChatCompletionParseParams } from 'openai/resources/beta/chat/completions';
import { calculateGptUsageCost } from './llmUtils.js';
import { commentators } from './commentators.js';
import type { ChatModel } from 'openai/resources';

const OPENAI_API_KEY = loadEnv("OPENAI_API_KEY");
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const OPENAI_MODEL_NAME: ChatModel = "gpt-4o-mini";
export const commentatorPluginForSlack: Plugin<SlackMetadata> = async (entries) => {
    console.debug(`Received ${entries.length} entries in commentatorPluginForSlack`);
    const updatedEntries: DataEntry<SlackMetadata>[] = [];

    // プロンプト部分の cache が効くように、シーケンシャルにリクエストを送る
    for (const entry of entries) {

        console.debug(`Requesting comments for ${entry.title}`);

        const response = await openai.beta.chat.completions.parse<ChatCompletionParseParams, {
            comments: {
                expertNumber: number;
                message: string;
            }[]
        }>({
            model: OPENAI_MODEL_NAME,
            temperature: 1.0,
            response_format: {
                type: "json_schema",
                json_schema: {
                    strict: true,
                    name: "comments",
                    description: "Comments from experts",
                    schema: {
                        type: "object",
                        additionalProperties: false,
                        required: ["comments"],
                        properties: {
                            comments: {
                                type: "array",
                                additionalProperties: false,
                                items: {
                                    type: "object",
                                    additionalProperties: false,
                                    required: ["expertNumber", "message"],
                                    properties: {
                                        expertNumber: {
                                            type: "integer"
                                        },
                                        message: {
                                            type: "string"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            messages: [
                {
                    role: 'system',
                    content: `You are an editor of experts. Please receive comments from following experts on the following article.
You don't have to contact all experts. You read the article and decide who is appropriate to ask for comments.
DO NOT ask for comments from experts who are not suitable for the article.
If suitable experts are multiple, you can ask up to 2 experts.
If suitable experts are not found, you can skip asking experts.

Comments must be written in Japanese.
You can regard a comment as a daily conversation.

The style of the comment is up to the expert, but there are some recommended points.
- Focus on the expert's opinion, not the article's summary.
- Mention only the relevant part of the article, and avoid talking about improvements.
- You should mention the only part of the article you are interested in. Do not talk about the bad and suggest the improvement.
- But also you must not be too positive, praise, extol the article.
- Skip parts you're not interested in; no need to cover everything.
- Keep comments under two sentences, but feel free to elaborate if needed.
- Point out specific parts or share personal impressions.
- Don't make abstract or generalized comments.
- Use outside knowledge and relate it to the article.
- You can comment on either positive or negative aspects, not both.
- Share thoughts on the future or past, based on the article.
- Treat the article as a casual web post, not a scientific paper.
- Skip commenting if you're not interested.
- Write casually, like in a tweet or reddit post.
- Assume the reader is familiar with the article and has basic knowledge.
- Don't force a connection to your field if it's unclear.

Commentators:
${commentators.map((commentator, index) => `${index + 1}. ${commentator.name} (${commentator.field}). (${commentator.details})`).join('\n')}
`
                },
                {
                    role: 'user',
                    content: `${entry.content}`
                },
            ],
        });

        console.debug(`Received comments for ${entry.title}`);
        const cost = response.usage !== undefined ? calculateGptUsageCost(OPENAI_MODEL_NAME, response.usage) : undefined;
        if (cost) {
            console.debug(`Cost: ${cost.cost.toFixed(5)} USD`);
        }

        if (response.choices[0].message.parsed === null) {
            updatedEntries.push({
                ...entry,
                metadata: {
                    additionalMessages: []
                }
            });
            continue;
        }

        const comments = response.choices[0].message.parsed.comments.map(comment => ({
            commentator: commentators[comment.expertNumber - 1],
            ...comment
        }));

        const additionalMessages: KnownBlock[] = comments.map(comment => ({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*${comment.commentator.name}*:\n${comment.message} (${comment.commentator.field})`
                }
            ]
        }));

        if (cost) {
            additionalMessages.push({
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `:moneybag: $${cost.cost.toFixed(5)} (cached-input: ${cost.cachedInputToken}, non-cached-input: ${cost.nonCachedInputToken}, output: ${cost.outputToken}, model: ${OPENAI_MODEL_NAME})`
                    }
                ]
            });
        }

        if (additionalMessages.length !== 0) {
            additionalMessages.push({
                type: "divider"
            });
        }



        updatedEntries.push({
            ...entry,
            metadata: {
                additionalMessages
            }
        })
    };

    return { results: updatedEntries };
};

