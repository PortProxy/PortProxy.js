import BaseClient from "./base-client";
import { createServer, Socket as NetSocket } from "net";

export default class NetClient extends BaseClient {
    private activeConnection: NetSocket | null = null;

    constructor(
        address: string,
        sessionId: string,
        private readonly processPort: number
    ) {
        super(address, sessionId);

        this.onConnect(socket => {
            socket.getInternal().addListener("data", buffer => {
                if (this.activeConnection) {
                    this.activeConnection.write(buffer);
                }
            });

            const server = createServer(connection => {
                if (this.activeConnection) {
                    connection.destroy();
                    return;
                }
                this.activeConnection = connection;

                connection.on("close", () => {
                    if (this.activeConnection == connection) {
                        this.activeConnection = null;
                    }
                });

                connection.addListener("data", buffer => {
                    socket.getInternal().write(buffer)
                });
            }).listen(processPort);

            this.onClose(() => server.close());
        });

        this.onClose(() => {
            if (this.activeConnection) {
                this.activeConnection.destroy();
            }
        });
    }
}