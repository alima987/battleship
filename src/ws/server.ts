import WebSocket, { WebSocketServer } from 'ws';
const wss= new WebSocketServer({ port: 8181 })
const clients = new Set();
wss.on('connection', (socket) => {
    clients.add(socket);

    socket.on('message', (message: string) => {
        clients.forEach((client: any) => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    socket.on('close', () => {
        clients.delete(socket);
    });
    socket.on('error', (error) => {
        console.error(`Socket error: ${error.message}`);
    });
});
console.log('WebSocket server is running on ws://localhost:8181');