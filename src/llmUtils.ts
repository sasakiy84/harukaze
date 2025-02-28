
import type { ChatModel, CompletionUsage } from "openai/resources";


const buildOpenAICostCalculator = ({
    cachedRate,
    nonCachedRate,
    outputRate,
}: {
    cachedRate: number;
    nonCachedRate: number;
    outputRate: number;
}) => {
    return (usage: CompletionUsage) => {
        const cachedInputToken = usage.prompt_tokens_details?.cached_tokens || 0;
        const nonCachedInputToken = usage.prompt_tokens - cachedInputToken;
        const outputToken = usage.completion_tokens;
        const cost =
            cachedInputToken * cachedRate +
            nonCachedInputToken * nonCachedRate +
            outputToken * outputRate;
        return {
            cost: cost,
            cachedInputToken: cachedInputToken,
            nonCachedInputToken: nonCachedInputToken,
            outputToken: outputToken,
        }
    }
};

// https://openai.com/ja-JP/api/pricing/
const ONE_MILLION = 1_000_000;

const GPT4O_MINI_CACHED_INPUT_TOKEN_RATE = 0.075 / ONE_MILLION;
const GPT4O_MINI_NON_CACHED_INPUT_TOKEN_RATE = 0.15 / ONE_MILLION;
const GPT4O_MINI_OUTPUT_TOKEN_RATE = 0.6 / ONE_MILLION;
export const calculateGpt4oMiniCost = buildOpenAICostCalculator({
    cachedRate: GPT4O_MINI_CACHED_INPUT_TOKEN_RATE,
    nonCachedRate: GPT4O_MINI_NON_CACHED_INPUT_TOKEN_RATE,
    outputRate: GPT4O_MINI_OUTPUT_TOKEN_RATE,
});

const GPT4O_CACHED_INPUT_TOKEN_RATE = 1.25 / ONE_MILLION;
const GPT4O_NON_CACHED_INPUT_TOKEN_RATE = 2.5 / ONE_MILLION;
const GPT4O_OUTPUT_TOKEN_RATE = 10 / ONE_MILLION;
export const calculateGpt4oCost = buildOpenAICostCalculator({
    cachedRate: GPT4O_CACHED_INPUT_TOKEN_RATE,
    nonCachedRate: GPT4O_NON_CACHED_INPUT_TOKEN_RATE,
    outputRate: GPT4O_OUTPUT_TOKEN_RATE,
});

export const calculateGptUsageCost = (model: ChatModel, usage: CompletionUsage) => {
    switch (model) {
        // 4o
        case 'gpt-4o':
        case 'gpt-4o-2024-11-20':
        case 'gpt-4o-2024-08-06':
        case 'gpt-4o-2024-05-13':
            {
                return calculateGpt4oCost(usage);
            }
        //  4o-mini
        case 'gpt-4o-mini':
        case 'gpt-4o-mini-2024-07-18':
            {
                return calculateGpt4oMiniCost(usage);
            }
        default:
            {
                throw new Error(`Unsupported model: ${model}`);
            }
    }
};