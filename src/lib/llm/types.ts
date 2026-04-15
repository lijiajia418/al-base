export interface ILLMClient {
  call(systemPrompt: string, userMessage: string): Promise<string>;
  stream?(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string>;
}
