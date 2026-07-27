import { connect, type NatsConnection, StringCodec } from "nats";

const sc = StringCodec();

export class NatsBus {
  private connection: NatsConnection | null = null;

  constructor(private readonly url: string) {}

  async start(): Promise<void> {
    try {
      this.connection = await connect({ servers: this.url, timeout: 1500 });
    } catch {
      this.connection = null;
    }
  }

  async stop(): Promise<void> {
    await this.connection?.drain();
    this.connection = null;
  }

  get connected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  publish(subject: string, payload: unknown): void {
    if (!this.connection || this.connection.isClosed()) {
      return;
    }
    this.connection.publish(subject, sc.encode(JSON.stringify(payload)));
  }
}
