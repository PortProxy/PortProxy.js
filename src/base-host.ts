import Socket from "./socket";

export type BaseHostEvent = "session" | "close" | "error" | "client";

export interface SessionDetails {
    id: string
    key: string
}

export default class BaseHost {
    private readonly socket: Socket;
    private readonly listeners = new Map<BaseHostEvent, ((payload: any | undefined) => void)[]>();
    private terminated = false;

    constructor(
        private readonly serverAddress: string
    ) {
        this.socket = new Socket(`${serverAddress}/host`, true);

        this.socket.on("close", async () => this.close());
        this.socket.on("error", async e => this.emit("error", e));
    
        this.socket.on("session_details", async msg => {
            const sessionId = msg.id as string;
            const sessionKey = msg.key as string;

            const internal = setInterval(() => {
                this.socket.send("keep_alive", {});
            }, 30_000);
            this.onClose(() => clearInterval(internal));

            this.emit("session", {
                id: sessionId,
                key: sessionKey
            });
            
            this.socket.on("new_client", async msg => {
                const clientId = msg.id;
                const dataSocket = new Socket(`${serverAddress}/host/${sessionId}/${sessionKey}/${clientId}`, false); // connection to client

                this.emit("client", dataSocket);
            });
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

    private addListener(id: BaseHostEvent, listener: (payload: any) => void) {
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

    private emit(id: BaseHostEvent, payload?: any) {
        const listeners = this.listeners.get(id);
        if (listeners) {
            for (let callback of listeners) {
                callback(payload);
            }
        }
    }
    
    public onSessionStart(listener: (details: SessionDetails) => void) {
        return this.addListener("session", listener);
    }

    public onClose(listener: () => void) {
        return this.addListener("close", listener);
    }

    public onError(listener: (error: any) => void) {
        return this.addListener("error", listener);
    }

    public onClientConnect(listener: (client: Socket) => void) {
        return this.addListener("client", listener);
    }
}