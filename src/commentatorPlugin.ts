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
            temperature: 0.2,
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
                    content: `You are an editor of experts. Please receive summary from following experts on the following article.
You don't have to contact all experts. You read the article and decide who is appropriate to ask for summary.
DO NOT ask for comments from experts who are not suitable for the article.
If suitable experts are multiple, choose most suitable one.
If suitable experts are not found, you can skip asking experts.

Comments must be written in Japanese.

The style of the comment is up to the expert, but there are some recommended points.
- Summarize the content of the article in a sentence, and quote the two of most important or attractive point in the article other than title.
    - Example:
"""    
この記事は、XXXX の経験について述べている。
- 「YYYY」
- 「ZZZZ」
"""
- When quoting, do not omit the quotation marks.
- When quoting, please clearly the context of the quote.
- The style of the summary is like twitter or reddit.
- Do not use redundant or polite, honorific expressions.
- Do not talk about the bad and suggest the improvement.
- Do not include your opinion, or impression.
- But also you must not be too positive, praise, extol the article.
- Readers are interested in technical or academic points, so please focus on them if possible.

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
                    text: `*${comment.commentator.name}*  (${comment.commentator.field}):\n${comment.message}`
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

