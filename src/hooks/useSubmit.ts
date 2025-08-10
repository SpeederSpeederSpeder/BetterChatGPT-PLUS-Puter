import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import {
  ChatInterface,
  ConfigInterface,
  MessageInterface,
  TextContentInterface,
} from '@type/chat';
import { getChatCompletion, getChatCompletionStream } from '@api/api';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens, updateTotalTokenUsed } from '@utils/messageUtils';
import { _defaultChatConfig } from '@constants/chat';
import { officialAPIEndpoint } from '@constants/auth';
import { modelStreamSupport } from '@constants/modelLoader';
import { isPuterEndpoint } from '@utils/api';

const useSubmit = () => {
  const { t, i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
  const apiKey = useStore((state) => state.apiKey);
  const setGenerating = useStore((state) => state.setGenerating);
  const generating = useStore((state) => state.generating);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setChats = useStore((state) => state.setChats);

  const generateTitle = async (
    message: MessageInterface[],
    modelConfig: ConfigInterface
  ): Promise<string> => {
    let data;
    try {
      if (
        !isPuterEndpoint(modelConfig.model) &&
        (!apiKey || apiKey.length === 0)
      ) {
        // official endpoint
        if (apiEndpoint === officialAPIEndpoint) {
          throw new Error(t('noApiKeyWarning') as string);
        }
        const titleChatConfig = {
          ..._defaultChatConfig, // Spread the original config
          model: useStore.getState().titleModel ?? _defaultChatConfig.model, // Override the model property
        };
        // other endpoints
        data = await getChatCompletion(
          useStore.getState().apiEndpoint,
          message,
          titleChatConfig,
          undefined,
          undefined
        );
      } else if (apiKey) {
        const titleChatConfig = {
          ...modelConfig, // Spread the original config
          model: useStore.getState().titleModel ?? modelConfig.model, // Override the model property
        };
        // own apikey
        data = await getChatCompletion(
          useStore.getState().apiEndpoint,
          message,
          titleChatConfig,
          apiKey,
          undefined
        );
      }
    } catch (error: unknown) {
      throw new Error(
        `${t('errors.errorGeneratingTitle')}\n${(error as Error).message}`
      );
    }
    return data.choices[0].message.content;
  };

  const handleSubmit = async () => {
    const chats = useStore.getState().chats;
    if (generating || !chats) return;

    const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));

    updatedChats[currentChatIndex].messages.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: '',
        } as TextContentInterface,
      ],
    });

    setChats(updatedChats);
    setGenerating(true);

    try {
      const isStreamSupported =
        modelStreamSupport[chats[currentChatIndex].config.model];
        const { model, temperature, max_tokens } = chats[currentChatIndex].config;
        const supportsStream = modelStreamSupport[model];
        console.log('[useSubmit] Model streaming support:', {
          model,
          supportsStream,
          isStreamSupported
        });
      let data;
      let stream;
      if (chats[currentChatIndex].messages.length === 0)
        throw new Error(t('errors.noMessagesSubmitted') as string);

      const messages = limitMessageTokens(
        chats[currentChatIndex].messages,
        chats[currentChatIndex].config.max_tokens,
        chats[currentChatIndex].config.model
      );
      if (messages.length === 0)
        throw new Error(t('errors.messageExceedMaxToken') as string);
      stream = await getChatCompletionStream(
        useStore.getState().apiEndpoint,
        messages,
        chats[currentChatIndex].config,
        apiKey,
        undefined
      );

        if (stream) {
          if (stream.locked)
            throw new Error(t('errors.streamLocked') as string);
          const reader = stream.getReader();
          let reading = true;
          let partial = '';
          while (reading && useStore.getState().generating) {
            const { done, value } = await reader.read();
            const decodedValue = new TextDecoder().decode(value);
            console.log('[useSubmit] Received raw stream value:', decodedValue);
            const result = parseEventSource(
              partial + decodedValue
            );
            partial = '';

            if (result === '[DONE]' || done) {
              reading = false;
            } else {
              const resultString = result.reduce((output: string, curr) => {
                if (typeof curr === 'string') {
                  partial += curr;
                } else {
                  if (!curr.choices || !curr.choices[0] || !curr.choices[0].delta) {
                    // cover the case where we get some element which doesnt have text data, e.g. usage stats
                    return output;
                  }
                  const content = curr.choices[0]?.delta?.content ?? null;
                  if (content) output += content;
                }
                return output;
              }, '');
              
              console.log('[useSubmit] Processed resultString:', resultString);

              const updatedChats: ChatInterface[] = JSON.parse(
                JSON.stringify(useStore.getState().chats)
              );
              const updatedMessages = updatedChats[currentChatIndex].messages;
              (
                updatedMessages[updatedMessages.length - 1]
                  .content[0] as TextContentInterface
              ).text += resultString;
              setChats(updatedChats);
            }
          }
          if (useStore.getState().generating) {
            reader.cancel(t('errors.cancelledByUser') as string);
          } else {
            reader.cancel(t('errors.generationCompleted') as string);
          }
          reader.releaseLock();
          stream.cancel();
        }
      
        // update tokens used in chatting
        const currChats = useStore.getState().chats;
        const countTotalTokens = useStore.getState().countTotalTokens;
  
        if (currChats && countTotalTokens) {
          const model = currChats[currentChatIndex].config.model;
          const messages = currChats[currentChatIndex].messages;
          updateTotalTokenUsed(
            model,
            messages.slice(0, -1),
            messages[messages.length - 1]
          );
        }
  
        // generate title for new chats
        if (
          useStore.getState().autoTitle &&
          currChats &&
          !currChats[currentChatIndex]?.titleSet
        ) {
          const messages_length = currChats[currentChatIndex].messages.length;
          const assistant_message =
            currChats[currentChatIndex].messages[messages_length - 1].content;
          const user_message =
            currChats[currentChatIndex].messages[messages_length - 2].content;
  
          const message: MessageInterface = {
            role: 'user',
            content: [
              ...user_message,
              ...assistant_message,
              {
                type: 'text',
                text: `Generate a title in less than 6 words for the conversation so far (language: ${i18n.language})`,
              } as TextContentInterface,
            ],
          };
  
          const updatedChats: ChatInterface[] = JSON.parse(
            JSON.stringify(useStore.getState().chats)
          );
          let title = (
            await generateTitle([message], updatedChats[currentChatIndex].config)
          ).trim();
          if (title.startsWith('"') && title.endsWith('"')) {
            title = title.slice(1, -1);
          }
          updatedChats[currentChatIndex].title = title;
          updatedChats[currentChatIndex].titleSet = true;
          setChats(updatedChats);
  
          // update tokens used for generating title
          if (countTotalTokens) {
            const model = _defaultChatConfig.model;
            updateTotalTokenUsed(model, [message], {
              role: 'assistant',
              content: [{ type: 'text', text: title } as TextContentInterface],
            });
          }
        }
    } catch (e: unknown) {
      const err = (e as Error).message;
      console.log(err);
      setError(err);
    }
    setGenerating(false);
  };

  return { handleSubmit, error };
};

export default useSubmit;
