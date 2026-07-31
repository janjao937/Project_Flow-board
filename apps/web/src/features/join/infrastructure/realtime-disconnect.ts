/**
 * Allows SessionRealtimeBridge to register an immediate disconnect hook
 * so guest leave does not wait for the next React effect tick.
 */
type DisconnectFn = () => void;

let disconnectRealtime: DisconnectFn | null = null;

export function registerRealtimeDisconnect(fn: DisconnectFn | null): void {
  disconnectRealtime = fn;
}

export function disconnectRealtimeNow(): void {
  disconnectRealtime?.();
}
