type UnlockRequest = {
  kind: "unlock";
  resolve: (passphrase: string | null) => void;
};

type ProtectRequest = {
  kind: "protect";
  resolve: (result: { encrypt: false } | { encrypt: true; passphrase: string } | null) => void;
};

export type PassphraseRequest = UnlockRequest | ProtectRequest;

type Listener = (request: PassphraseRequest | null) => void;

let listener: Listener | null = null;
let pending: PassphraseRequest | null = null;

export function subscribePassphrasePrompt(next: Listener): () => void {
  listener = next;
  if (pending) {
    next(pending);
  }
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

export function requestUnlockPassphrase(): Promise<string | null> {
  return new Promise((resolve) => {
    pending = {
      kind: "unlock",
      resolve: (value) => {
        pending = null;
        listener?.(null);
        resolve(value);
      },
    };
    listener?.(pending);
  });
}

export function requestProtectPassphrase(): Promise<
  { encrypt: false } | { encrypt: true; passphrase: string } | null
> {
  return new Promise((resolve) => {
    pending = {
      kind: "protect",
      resolve: (value) => {
        pending = null;
        listener?.(null);
        resolve(value);
      },
    };
    listener?.(pending);
  });
}
