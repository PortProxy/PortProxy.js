import WebSocket from "websocket-stream";

export type NodePacketId = (
    "connection_type"
);

export type ServerPacketId = (
    "session_details" |
    "new_client" |
    "client_connected"
);

export type ServerSocketEvent = ServerPacketId | "close" | "error";

export type PacketListener = (packet: any) => Promise<void>;

export default class Socket {
    private listeners = new Map<ServerSocketEvent, PacketListener[]>();
    private internal: WebSocket.WebSocketDuplex;

    constructor(
        socketAddress: string,
        private usePacketEvents: boolean
    ) {
        this.internal = WebSocket(socketAddress);

        this.internal.addListener("close", () => this.emit("close"));
        this.internal.addListener("error", e => this.emit("error", e));

        // this.on("error", async e => {
        //     if (e?.code == "ECONNREFUSED") {
        //         console.log("Failed to connect to PortProxy!");
        //     } else {
        //         console.error("Websocket encountered an error!", e);
        //     }
        // });

        this.internal.addListener("data", raw => {
            if (!this.usePacketEvents) return;
            try {
                const message = JSON.parse(raw.toString("utf-8"));
                const packetId = message?.packetId as string;

                const listeners = this.listeners.get(packetId as ServerPacketId);
                if (listeners) {
                    listeners.forEach(async listener => {
                        try {
                            await listener(message);
                        } catch (e) {
                            console.error(e);
                        }
                    });
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    private emit(packetId: ServerSocketEvent, data?: Object) {
        const listeners = this.listeners.get(packetId);
        if (listeners) {
            for (let listener of listeners) {
                listener(data);
            }
        }
    }

    public on(packetId: ServerSocketEvent, listener: PacketListener) {
        const existingListeners = this.listeners.get(packetId);

        if (existingListeners) {
            existingListeners.push(listener);
        } else {
            this.listeners.set(packetId, [listener]);
        }

        return () => {
            const existingListeners = this.listeners.get(packetId);
            if (existingListeners) {
                const index = existingListeners.indexOf(listener);
                if (index >= 0) {
                    existingListeners.splice(index, 1);
                }
                if (!existingListeners.length) {
                    this.listeners.delete(packetId);
                }
            }
        }
    }

    public send(packetId: NodePacketId, message: Object) {
        if ((message as any).packetId !== undefined) {
            throw "Attempted to send a message to socket that contains a packet id.";
        }
        this.internal.push(JSON.stringify({
            packetId,
            ...message
        }, null, 2));
    }

    public close() {
        this.internal.destroy();
        this.listeners.clear();
    }

    public getInternal() {
        return this.internal;
    }

    public enablePacketEvents(enabled: boolean) {
        this.usePacketEvents = enabled;
    }
}