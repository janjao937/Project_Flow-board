interface CloudflareEnv {
  RUNTIME_CONFIG: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  ASSETS: {
    fetch: typeof fetch;
  };
}
