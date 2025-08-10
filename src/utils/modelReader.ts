import { ModelCost } from '@type/chat';
import useStore from '@store/store';
import { CustomModel } from '@store/custom-models-slice';

interface ModelData {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: any;
  // TODO: Remove workaround once openrouter supports it;
  is_stream_supported: boolean; // custom field until better workaround or openrouter proper support
}

interface ModelsJson {
  data: ModelData[];
}

const modelsJsonUrl = 'models.json';

export const loadModels = async (): Promise<{
  modelOptions: string[];
  modelMaxToken: { [key: string]: number };
  modelCost: ModelCost;
  modelTypes: { [key: string]: string };
  modelStreamSupport: { [key: string]: boolean };
  modelDisplayNames: { [key: string]: string };
}> => {
  const modelOptions: string[] = [];
  const modelMaxToken: { [key: string]: number } = {};
  const modelCost: ModelCost = {};
  const modelTypes: { [key: string]: string } = {};
  const modelStreamSupport: { [key: string]: boolean } = {};
  const modelDisplayNames: { [key: string]: string } = {};

  const specificModels = [
    { id: 'gpt-4o-mini', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'GPT-4o-mini' },
    { id: 'gpt-4o', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'GPT-4o' },
    { id: 'o1', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O1' },
    { id: 'o1-mini', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O1 Mini' },
    { id: 'o1-pro', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O1 Pro' },
    { id: 'o3', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O3' },
    { id: 'o3-mini', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O3 Mini' },
    { id: 'o4-mini', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'O4 Mini' },
    { id: 'gpt-5', context_length: 400000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-5' },
    { id: 'gpt-5-mini', context_length: 400000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-5 Mini' },
    { id: 'gpt-5-nano', context_length: 400000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-5 Nano' },
    { id: 'gpt-5-chat-latest', context_length: 400000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-5 Chat Latest' },
    { id: 'gpt-4.1', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-4.1 Mini' },
    { id: 'gpt-4.1-nano', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-4.1 Nano' },
    { id: 'gpt-4.5-preview', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'GPT-4.5 Preview' },
    { id: 'claude-sonnet-4', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Claude Sonnet 4' },
    { id: 'claude-opus-4', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Claude Opus 4' },
    { id: 'claude-3-7-sonnet', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet', context_length: 200000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Claude 3.5 Sonnet' },
    { id: 'deepseek-chat', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Deepseek Chat' },
    { id: 'deepseek-reasoner', context_length: 128000, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Deepseek Reasoner' },
    { id: 'gemini-2.0-flash', context_length: 1048576, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-flash', context_length: 1048576, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Gemini 1.5 Flash' },
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', context_length: 131072, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Llama 3.1 8B' },
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', context_length: 131072, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Llama 3.1 70B' },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', context_length: 131072, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Llama 3.1 405B' },
    { id: 'mistral-large-latest', context_length: 32768, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Mistral Large' },
    { id: 'pixtral-large-latest', context_length: 32768, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'image', is_stream_supported: true, name: 'Pixtral Large' },
    { id: 'codestral-latest', context_length: 32768, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Codestral' },
    { id: 'google/gemma-2-27b-it', context_length: 8192, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Gemma 2 27B' },
    { id: 'grok-beta', context_length: 8192, pricing: { prompt: '0', completion: '0', image: '0', request: '0' }, type: 'text', is_stream_supported: true, name: 'Grok Beta' },
  ];

  specificModels.forEach((model) => {
    modelOptions.push(model.id);
    modelMaxToken[model.id] = model.context_length;
    modelCost[model.id] = {
      prompt: { price: parseFloat(model.pricing.prompt), unit: 1 },
      completion: { price: parseFloat(model.pricing.completion), unit: 1 },
      image: { price: parseFloat(model.pricing.image), unit: 1 },
    };
    modelTypes[model.id] = model.type;
    modelStreamSupport[model.id] = model.is_stream_supported;
    modelDisplayNames[model.id] = model.name || model.id;
  });

  return {
    modelOptions,
    modelMaxToken,
    modelCost,
    modelTypes,
    modelStreamSupport,
    modelDisplayNames,
  };
};

export type ModelOptions = string;
