export type TtsSynthesizeOptions = {
  voice?: string;
  speed?: number;
  signal?: AbortSignal;
};

export interface TtsProvider {
  readonly name: 'openai' | 'browser' | 'gemini' | 'mock';
  readonly contentType?: 'audio/mpeg' | 'audio/wav';
  synthesize(text: string, options?: TtsSynthesizeOptions): Promise<Buffer | NodeJS.ReadableStream>;
}
