import WebSocket, { WebSocketServer } from 'ws';
import * as http from 'http';
import * as uuid from 'uuid';
import { Player } from '../response/player.ts';
import { PlayerState, Room } from '../response/room.ts';
import { Message, Session, SessionState } from '../response/session.ts';

export const server = http.createServer();
const wss = new WebSocketServer({ server });

const players = new Map<string, Player>()
const winners = new Map<string, number>()
const playersSessions = new Map<string, Session>();
const sessions = new Set<Session>();
const rooms = new Set<Room>();
let roomInx = 1
const roomsById = new Map<number, Room>()

const getPlayers = (login: string): Player | undefined => {
  const player = players.get(login)
  if (player) {
    console.log(`Player login is [${player?.login}]`)
  } else {
    console.log(`Player [${login}] is not found`)
  }
  return player
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
  const { name, password } = JSON.parse(request.data)
  let error: boolean = false
  let errorText: string = '';
  if ( name && password ) {
    let player = getPlayers(name)
    if (player) {
        if (!checkPassword(name, password)) {
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
        player = new Player(name, password);
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
    name: name,
    index: 1,
    error: error,
    errorText: errorText
  })
}

const updateWinners = (winner: string = ''): Message => {
  if (winner.length) {
     let wins = winners.get(winner) || 0
     wins++
     winners.set(winner, wins)
  }
  let data: { name: string; wins: number; }[] = []
  winners.forEach((m, k) => {
    data.push({ name: k, wins: m})
  }) 
  data.sort((a, b) => { return (b.wins - a.wins) })
  return new Message('update_winners', data, 'all')
}
const updateRooms = (): Message => {
    let data: { roomId: number; roomUsers: { name: string; index: number | string; }[]; }[] = []

    rooms.forEach((el) => {
      if (el.players.length === 1) {
        data.push(el.toJSON())
      }
    })
    return new Message('update_room', data, 'all')
}
const createRoom = (session: Session, request: Message): Message => {
  let error: boolean = false
  let errorText: string = 'Unable to create room';
  const player = session.player
  if (player) {
    const id = roomInx++
    const newRoom = new Room(id)
    newRoom.addPlayer(player)
    rooms.add(newRoom)
    roomsById.set(id, newRoom)
    const res = updateRooms()
    res.rcpt = 'all'
    return res
  }

    return new Message("create_room", { error: error, errorText: errorText,}, 'all',)
}
const addUserToRoom = (session: Session, request: Message): Message[] => {
  let error: boolean = false
  let errorText: string = 'Unable to add player to the room';
  const player = session.player
  const data = JSON.parse(request.data)
  const roomId = data.indexRoom
  const res = new Array<Message>

  if (player && roomId) {
    const room = roomsById.get(roomId)
    if (room) {
        if (room.players.length === 1 && room.players[0].player.login != player.login) {
            room.addPlayer(player)
            res.push(updateRooms())
            res.push(new Message( 'create_game', { idGame: roomId, idPlayer: 1 }))
            res.push(new Message( 'create_game', { idGame: roomId, idPlayer: 0 }, room.players[0].player.login))
        }
    }
  }
   return res
}
function turn(room: Room, activePlayer: number): Message[] {
    const resps = new Array<Message>;

    if (room && room.numPlayersInState(PlayerState.READY) === 2) {
        resps.push(new Message('turn', {
            currentPlayer: activePlayer
        }, room.players[0].player.login));
        resps.push(new Message('turn', {
            currentPlayer: activePlayer
        }, room.players[1].player.login));
        room.player_id = activePlayer;
    }
    return resps;
}
function win(room: Room, winner: number): Message[] {
    const resps = new Array<Message>;

    if (room && room.numPlayersInState(PlayerState.READY) === 2) {
        resps.push(new Message('finish', {
            winPlayer: winner
        }, room.players[0].player.login));
        resps.push(new Message('finish', {
            winPlayer: winner
        }, room.players[1].player.login));
        rooms.delete(room);
        resps.push(updateRooms());
        resps.push(updateWinners(room.players[winner].player.login));
    }
    return resps;
}
function addShips(session: Session, request: Message): Message[] {
    let err: boolean = true;
    let erTxt: string = 'Unable to add ships';
    let rcpt = '';
    const data = JSON.parse(request.data);
    const roomId = data.gameId;
    const resps = new Array<Message>;
    const room = roomsById.get(roomId);
    if (room) {
        const playerIdx = data.indexPlayer;
      
        if (room.addShips(playerIdx, data.ships)) {
            if (room.numPlayersInState(PlayerState.READY) === 2) {
                const activePlayer = Math.round(Math.random());
              
                resps.push(new Message('start_game', {
                    ships: room.players[0].gameField.getShipsAsJson(),
                    currentPlayerIndex: activePlayer
                }, room.players[0].player.login));
                resps.push(new Message('start_game', {
                    ships: room.players[1].gameField.getShipsAsJson(),
                    currentPlayerIndex: activePlayer
                }, room.players[1].player.login));
                resps.push(...turn(room, activePlayer));
                return resps;
            }
            else {
                err = false;
                erTxt = 'Ships added';
                rcpt = 'none';
            }
        }

    }

    resps.push(new Message(request.type, {
        error: err,
        errorText: erTxt,
    }, rcpt));

    return resps;
}

function attack(session: Session, request: Message): Message[] {
    let err: boolean = true;
    let erTxt: string = 'Unable to attack';
    let rcpt = '';
    const data = JSON.parse(request.data);
    const roomId = data.gameId;
    const resps = new Array<Message>;
    const room = roomsById.get(roomId);
    if (room) {
        const playerIdx = data.indexPlayer;
        if (room.player_id === playerIdx) {
            const x = data.x;
            const y = data.y;
            const diffs = room.attack(playerIdx, x, y);
            const res = diffs[0].val;
            diffs.forEach(diff => {
                const val = diff.val
                let resStr: string;
                switch (val) {
                    case 2:
                        resStr = 'shot';
                        break;

                    case 3:
                        resStr = 'killed';
                        break;

                    default:
                        resStr = 'miss';
                        break;
                }
                resps.push(new Message('attack', {
                    position: { x: diff.x, y: diff.y },
                    currentPlayer: playerIdx,
                    status: resStr
                }, room.players[0].player.login));
                resps.push(new Message('attack', {
                    position: { x: diff.x, y: diff.y },
                    currentPlayer: playerIdx,
                    status: resStr
                }, room.players[1].player.login));
            });
            if (res === 4) {
                const activePlayer = playerIdx > 0 ? 0 : 1;
                resps.push(...turn(room, activePlayer));
            }
            else if (res === 3 && room.isGameOver(playerIdx)) {
                resps.push(...win(room, playerIdx));
            }
            return resps;
        }
        else {
            erTxt = 'Not your turn';
        }

    }

    resps.push(new Message(request.type, {
        error: err,
        errorText: erTxt,
    }, rcpt));

    return resps;
}
function randomAttack(session: Session, request: Message): Message[] {
    let err: boolean = true;
    let erTxt: string = 'Unable to attack';
    const data = JSON.parse(request.data);
    const roomId = data.gameId;
    const playerIdx = data.indexPlayer;
    const resps = new Array<Message>;
    const room = roomsById.get(roomId);
    if (room) {
        const playerIdx = data.indexPlayer;
        if (room.player_id === playerIdx) {
            const { x, y } = room.getRndXY4Attack(playerIdx);
            resps.push(...attack(session,
                new Message('attack', JSON.stringify({
                    gameId: roomId,
                    x: x,
                    y: y,
                    indexPlayer: playerIdx
                }))
            ));
            return resps;
        }
        else {
            erTxt = 'Not your turn';
        }
    }

    resps.push(new Message(request.type, {
        error: err,
        errorText: erTxt,
    }));

    return resps;
}

const sendMessages = (wss: WebSocketServer, ws: WebSocket, msgs: Message[]) => {
    msgs.forEach(msg => {
        const str: string = msg.toString();

        switch (msg.rcpt) {
            case 'none':
                break;

            case 'all':
                console.log("Send message to ALL");
                console.log('<-\nResponse:', JSON.parse(str));
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(str);
                    }
                });
                break;

            case '':
                console.log("Send message to default recipient");
                console.log('<-\nResponse:', JSON.parse(str));
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(str);
                }
                break;

            default:
                console.log("Send message to " + msg.rcpt);
                console.log('<-\nResponse:', JSON.parse(str));
                const session = playersSessions.get(msg.rcpt);
                if (session) {
                    if (session.ws.readyState === WebSocket.OPEN) {
                        session.ws.send(str);
                    }
                }
                break;
        }
    });
}

const parseMessages = (session: Session, request: Message) => {
    let response = new Array<Message>
    switch(request.type) {
      case "reg": 
        response.push(playerRegistration(session, request))
        response.push(updateWinners())
        response.push(updateRooms())
        break;
      case "create_room":
        response.push(createRoom(session, request)) 
        break; 
      case "add_user_to_room":
        addUserToRoom(session, request).forEach((res) => {
            response.push(res)
        })
        break;  
      case "add_ships":
        addShips(session, request).forEach(resp => {
            response.push(resp);
        });
        break;
      case 'attack':
        attack(session, request).forEach(resp => {
            response.push(resp);
        });
        break;
      case 'randomAttack':
        randomAttack(session, request).forEach(resp => {
            response.push(resp);
        });
            break;
      default:
        response.push(new Message("error", { 'error': true, 'errorText': "Unknow message type" }));
        break;
    }
    return response
}

wss.on('connection', (ws: WebSocket) => {
    const session: Session = new Session(uuid.v4(), ws, SessionState.OPEN)
    sessions.add(session)
    console.log(`Created session [${session}]`)

    ws.on('message', (message: string) => {
        console.log(`Session is [${session.id}]`);
        try {
            console.log(`\nRequest: `, JSON.parse(message))
            const msg = Message.fromJson(JSON.parse(message))
            let response: Message[] = parseMessages(session, msg)
            sendMessages(wss, ws, response)

        } catch(error) {
            console.log(error);
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
        const player = session.player;
        if (player) {
            playersSessions.delete(player.login)
             rooms.forEach(room => {
                room.players.forEach((p, i) => {
                    if (p.player && p.player.login === player.login) {
                        const activePlayer = i > 0 ? 0 : 1;
                        sendMessages(wss, ws, win(room, activePlayer));
                    }
                });
            });
        }
       sessions.delete(session);
    });
    ws.on('error', (error) => {
        console.error(`Socket error: ${error.message}`);
    });
    ws.send(Message.fromJson({ type: "connected", data: { session: session.id }, id: 0 }).toString());
});
console.log('WebSocket server is running on ws://localhost:8181');
