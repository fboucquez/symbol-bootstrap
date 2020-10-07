import * as net from 'net';

export class PortService {
    public static async isReachable(port: number, host: string, timeout = 1000): Promise<boolean> {
        const promise = new Promise((resolve, reject) => {
            const socket = new net.Socket();

            const onError = () => {
                socket.destroy();
                reject();
            };

            socket.setTimeout(timeout);
            socket.once('error', onError);
            socket.once('timeout', onError);

            socket.connect(port, host, () => {
                socket.end();
                resolve();
            });
        });

        try {
            await promise;
            return true;
        } catch (_) {
            return false;
        }
    }
}
