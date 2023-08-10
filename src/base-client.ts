import Socket from "./socket";

export type BaseClientEvent = "connect" | "close" | "error";

export default class BaseClient {
    private readonly socket: Socket;
    private readonly listeners = new Map<BaseClientEvent, ((payload: any | undefined) => void)[]>();
    private terminated = false;

    constructor(
        private readonly address: string,
        private readonly sessionId: string
    ) {
        this.socket = new Socket(`${address}/client/${sessionId}`, true);

        this.socket.on("close", async () => this.close());
        this.socket.on("error", async e => this.emit("error", e));

        this.socket.on("client_connected", async () => {
            this.socket.enablePacketEvents(false);
            
            this.emit("connect", this.socket);
        });
    }

    public close() {
        if (!this.terminated) {
            this.terminated = true;
            this.emit("close");
            this.socket.close();
            this.listeners.clear();
        }
    }


    private addListener(id: BaseClientEvent, listener: (payload: any) => void) {
        const listeners = this.listeners.get(id);
        if (listeners) {
            listeners.push(listener);
        } else {
            this.listeners.set(id, [listener]);
        }

        return () => {
            const listeners = this.listeners.get(id);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index >= 0) {
                    listeners.splice(index, 1);
                }
                if (!listeners.length) {
                    this.listeners.delete(id);
                }
            }
        }
    }

    private emit(id: BaseClientEvent, payload?: any) {
        const listeners = this.listeners.get(id);
        if (listeners) {
            for (let callback of listeners) {
                callback(payload);
            }
        }
    }

    public onConnect(listener: (host: Socket) => void) {
        return this.addListener("connect", listener);
    }

    public onClose(listener: () => void) {
        return this.addListener("close", listener);
    }

    public onError(listener: (error: any) => void) {
        return this.addListener("error", listener);
    }
}