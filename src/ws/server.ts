import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import { Player } from '../response/player';
import { Room } from '../response/room';
import { Message, Session } from '../response/session';

export const server = http.createServer()
const wss= new WebSocketServer({ server })

const players = new Map<string, Player>()
const playersSessions = new Map<string, Session>();
const sessions = new Set<Session>();
export const rooms = new Map<string, Room>();  
const clients = new Set();

const getPlayers = (login: string): Player | undefined => {
  const player = players.get(login)
  if (player) {
    console.log(`Player login is [${player?.login}]`)
    return player;
  } else {
    console.log(`Player [${login}] is not found`)
    return undefined
  }
}
const addPlayer = (player: Player) => {
  players.set(player.login, player)
}
const checkPassword = (login: string, password: string): boolean => {
    const player = getPlayers(login)
    return !!player && player.password === password;
}
const getPlayerSession = (player: Player): Session | undefined => {
  const session = playersSessions.get(player.login)
  return session ? session : undefined
}
const playerRegistration = (session: Session, request: Message): Message => {
  const { login, password } = JSON.parse(request.data)
  let error: boolean = false
  let errorText: string = '';
  if ( login && password ) {
    let player = getPlayers(login)
    if (player) {
        if (!checkPassword(login, password)) {
            error = true;
            errorText = 'Authentication failed.'
        } else {
            let playersSession = getPlayerSession(player) 
            if (playersSession) {
                if (session.id === playersSession.id) {
                    errorText = 'Repeated registeration.'
                } else {
                    errorText = 'Already registered in another session.'
                    error = true
                }
            } else {
                session.player = player;
                playersSessions.set(player.login, session)
                console.log(`Player [${player.login}] was registered, session is [${session.id}]`)
            }
        }
    } else {
        player = new Player(login, password);
        addPlayer(player)
        session.player = player
        playersSessions.set(player.login, session)
        console.log(`Player [${player.login}] was added, session is [${session.id}]`);
    }
  } else {
    error = true
    errorText = 'No login or password provided.'
  }
  return new Message(request.type, {
    name: login,
    index: 1,
    error: error,
    errorText: errorText
  })
}

const parseMessages = (session: Session, request: Message) => {
    let response = new Array<Message>
    switch(request.type) {
      case "reg": 
        response.push(playerRegistration(session, request))
        break
    }
}

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
server.listen(8181, () => {
  console.log('WebSocket server is running on ws://localhost:8181');
});