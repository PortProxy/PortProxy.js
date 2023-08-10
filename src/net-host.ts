import BaseHost from "./base-host";
import Socket from "./socket";
import { createConnection, Socket as NetSocket } from "net";

interface Connection {
    dataSocket: Socket
    netSocket?: NetSocket
}

export default class NetHost extends BaseHost {
    private readonly connections: Connection[] = [];

    constructor(
        serverAddress: string,
        private readonly processAddress: string,
        private readonly processPort: number
    ) {
        super(serverAddress);

        let hadErrorLast: boolean | null = null;

        this.onClose(() => {
            for (let connection of this.connections) {
                connection.dataSocket.close();
                connection.netSocket?.destroy();
            }
        });

        this.onClientConnect(dataSocket => {
            const connection: Connection = {
                dataSocket
            }
            this.connections.push(connection);

            let localSocket: NetSocket;
            function startConnection(host: NetHost) {
                if (localSocket) {
                    localSocket.destroy();
                }

                localSocket = createConnection({
                    host: host.processAddress,
                    port: host.processPort
                });
                connection.netSocket = localSocket;

                localSocket.on("data", buffer => {
                    dataSocket.getInternal().write(buffer);
                });

                localSocket.on("connect", () => {
                    if (hadErrorLast == true || hadErrorLast === null) {
                        hadErrorLast = false;
                        // console.log(`Connected to process '${host.processAddress}:${host.processPort}'!`);
                    }
                });

                localSocket.on("close", async e => {
                    if (e) {
                        if (!hadErrorLast) {
                            // console.log(`Couldn't connect to process '${host.processAddress}:${host.processPort}'. Waiting...`);
                            hadErrorLast = true;
                        }
                        setTimeout(() => {
                            startConnection(host);
                        }, 500);
                    } else {
                        startConnection(host);
                    }
                });

                localSocket.on("error", () => {});
            }
            
            if (hadErrorLast === null) {
                // console.log(`Connecting to process '${this.processAddress}:${this.processPort}'...`);
            }
            startConnection(this);


            dataSocket.getInternal().addListener("data", buffer => {
                localSocket.write(buffer);
            });

            dataSocket.on("close", async () => {
                localSocket.destroy();
                dataSocket.close();
                const index = this.connections.indexOf(connection);
                if (index >= 0) {
                    this.connections.splice(index, 1);
                }
            });
        });
    }
}