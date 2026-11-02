export type TtsSynthesizeOptions = {
  voice?: string;
  speed?: number;
  signal?: AbortSignal;
};

export interface TtsProvider {
  readonly name: 'openai' | 'browser' | 'mock';
  synthesize(text: string, options?: TtsSynthesizeOptions): Promise<Buffer | NodeJS.ReadableStream>;
}
