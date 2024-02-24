import { httpServer } from "./src/http_server/index";
import { server } from "./src/ws-server/server";


const HTTP_PORT = 8181;
const WS_PORT = 3000;


httpServer.listen(HTTP_PORT, () => {
    console.log(`Start static http server on the ${HTTP_PORT} port!`);
});

server.listen(WS_PORT, () => {
    console.log('WebSocket server is listening on port 3000');
});