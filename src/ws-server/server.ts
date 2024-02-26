import * as http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { Player } from '../responces/user';
import { Message } from '../responces/session-message';
import { PlayerState, Room } from '../responces/rooms';
import * as uuid from 'uuid';
import { Session, SessionState } from '../responces/session-message';


export const server = http.createServer();
const wss = new WebSocketServer({ server });

const players = new Map<string, Player>();
const sessions = new Set<Session>();
const rooms = new Set<Room>();
let roomIdx = 1;
const playersSessions = new Map<string, Session>();
const roomsById = new Map<number, Room>();
const winners = new Map<string, number>();

function getPlayer(login: string): Player | undefined {
    const player = players.get(login);
    if (player) {
        console.log(`player: login: [${player?.login}]`);
    }
    else {
        console.log(`Player [${login}] is not found`);
    }
    return player;
}

function addPlayer(player: Player) {
    players.set(player.login, player);
}

function checkPassword(login: string, password: string): boolean {
    const player = getPlayer(login);
    if (player && player.password === password) {
        return true;
    }

    return false;
}

function getPlayerSession(player: Player): Session | undefined {
    const session = playersSessions.get(player.login);
    if (session) {
        return session;
    }
    return undefined;
}


function registerPlayer(session: Session, request: Message): Message {
    let { name, password } = JSON.parse(request.data);
    let err: boolean = false;
    let erTxt: string = '';
    if (name && password) {
        let player = getPlayer(name);
        if (player) {
            if (!checkPassword(name, password)) {
                err = true;
                erTxt = 'Authentication failed.';
            }
            else {
                let playerSession = getPlayerSession(player);
                if (playerSession) {
                    if (session.id === playerSession.id) {
                        erTxt = 'Repeated registeration.';
                    }
                    else {
                        erTxt = 'Already registered in another session.'
                        err = true;
                    }
                }
                else {
                    session.player = player;
                    playersSessions.set(player.login, session);
                    console.log(`Player [${player.login}] was registered, session is [${session.id}]`);
                }
            }
        }
        else {
            player = new Player(name, password);
            addPlayer(player);
            session.player = player;
            playersSessions.set(player.login, session);
            console.log(`Player [${player.login}] was added, session is [${session.id}]`);
        }
    }
    else {
        err = true;
        erTxt = 'No login or password provided.';
    }
    return new Message(request.type, {
        name: name,
        index: 1,
        error: err,
        errorText: erTxt,
    });
}


function getAvaliableRooms(): Message {
    let data: any[] = [];

    rooms.forEach(room => {
        if (room.players.length === 1) {
            data.push(room.toJSON());
        }
    });

    return new Message('update_room', data, 'all');
}


function updateWinners(winner: string = ''): Message {
    if (winner.length) {
        let wins = winners.get(winner) || 0;
        wins++;
        winners.set(winner, wins);
    }

    let data: any[] = [];

    winners.forEach((v, k) => {
        data.push({ name: k, wins: v });
    });
    data.sort((a, b) => { return (b.wins - a.wins) });

    return new Message('update_winners', data, 'all');
}


function createRoom(session: Session, request: Message): Message {
    let err: boolean = true;
    let erTxt: string = 'Unable to create a room';
    const player = session.player;
    if (player) {
        const id = roomIdx++;
        const newRoom = new Room(id);
        newRoom.addPlayer(player);
        rooms.add(newRoom);
        roomsById.set(id, newRoom);
        const resp = getAvaliableRooms();
        resp.rcpt = 'all';
        return resp;
    }

    return new Message(request.type, {
        error: err,
        errorText: erTxt,
    }, 'all');
}


function addPlayer2Room(session: Session, request: Message): Message[] {
    let err: boolean = true;
    let erTxt: string = 'Unable to add player to the room';
    const player = session.player;
    const data = JSON.parse(request.data);
    const roomId = data.indexRoom;

    const resps = new Array<Message>;
    if (player && roomId) {
        const room = roomsById.get(roomId);
        if (room) {
            if (room.players.length === 1 && room.players[0].player.login != player.login) {
                room.addPlayer(player);
                resps.push(getAvaliableRooms());
                resps.push(new Message(
                    'create_game', { idGame: roomId, idPlayer: 1 }
                ));
                resps.push(new Message(
                    'create_game', { idGame: roomId, idPlayer: 0 }, room.players[0].player.login
                ));
            }
        }
    }

    return resps;
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
        room.activePlayerIdx = activePlayer;
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
        resps.push(getAvaliableRooms());
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
        if (room.activePlayerIdx === playerIdx) {
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
        if (room.activePlayerIdx === playerIdx) {
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


function sendMessages(wss: WebSocketServer, ws: WebSocket, msgs: Message[]) {
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


function processMessage(session: Session, request: Message): Message[] {
    let response = new Array<Message>;

    switch (request.type) {
        case "reg":
            response.push(registerPlayer(session, request));
            response.push(getAvaliableRooms());
            response.push(updateWinners());
            break;

        case "create_room":
            response.push(createRoom(session, request));
            break;

        case "add_user_to_room":
            addPlayer2Room(session, request).forEach(resp => {
                response.push(resp);
            });
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

    return response;
}

wss.on('connection', (ws: WebSocket) => {
    const session: Session = new Session(uuid.v4(), ws, SessionState.OPEN);
    sessions.add(session);
    console.log(`Created session [${session}]`);

    ws.on('message', (message: string) => {
        console.log(`Session is [${session.id}]`);
        try {
            console.log('->\nRequest:', JSON.parse(message));
            const msg = Message.fromJson(JSON.parse(message));
            let response: Message[] = processMessage(session, msg);
            sendMessages(wss, ws, response);
        } catch (error) {
            console.log(error);
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
        const player = session.player;
        if (player) {
            playersSessions.delete(player.login);
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

    ws.send(Message.fromJson({ type: "connected", data: { session: session.id }, id: 0 }).toString());
});
