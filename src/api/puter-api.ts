import { ConfigInterface, MessageInterface } from '@type/chat';

declare global {
  interface Window {
    puter: any;
  }
}

export const getPuterChatCompletionStream = async (
  messages: MessageInterface[],
  config: ConfigInterface
) => {
  // Map our messages to the format puter.ai.chat expects
  const puterMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const model = config.model;

  const asyncIterable = await window.puter.ai.chat(
    puterMessages,
    false, // testMode
    {
      model: model,
      stream: true,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    }
  );

  // Adapt the Puter async iterable to a ReadableStream that BetterChatGPT expects
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const part of asyncIterable) {
        const text = part?.text;
        if (text && text.length > 0) {
          // We need to format it like an OpenAI SSE event.
          const chunk = {
            choices: [
              {
                delta: {
                  content: text,
                },
              },
            ],
          };
          const formattedChunk = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(formattedChunk));
        }
      }
      // After the loop, send a [DONE] message to signify the end.
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return stream;
};
export const getPuterChatCompletion = async (
  messages: MessageInterface[],
  config: ConfigInterface
) => {
  // Map our messages to the format puter.ai.chat expects
  const puterMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const model = config.model;

  const response = await window.puter.ai.chat(
    puterMessages,
    false, // testMode
    {
      model: model,
      stream: false,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
    }
  );

  // Adapt the Puter response to the format BetterChatGPT expects
  return {
    choices: [
      {
        message: {
          content: response.text,
        },
      },
    ],
  };
};