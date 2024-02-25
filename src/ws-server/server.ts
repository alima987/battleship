import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { User } from "../responces/user";
import { Session, Message, StateSession} from '../responces/session-message';
import { Room, UserState } from '../responces/rooms';
import * as uuid from 'uuid';
export const server = http.createServer();
const wss = new WebSocketServer({ server });
let roomId = 1;
const users = new Map<string, User>();
const usersSession = new Map<string, Session>();
const rooms = new Set<Room>();
const roomById = new Map<number, Room>();
const winnersMap = new Map<string, number>();
const sessionsMap = new Set<Session>();
function getUser(login: string): User | undefined {
    const user = users.get(login);
    if (user) {
        console.log(`user: login: [${user?.login}]`);
    }
    else {
        console.log(`user [${login}] is not found`);
    }
    return user;
}
function addUser(user: User) {
    users.set(user.login, user);
}

function checkPassword(login: string, password: string): boolean {
    const user = getUser(login);
    if (user && user.password === password) {
        return true;
    }

    return false;
}
function getUserSession(user: User): Session | undefined {
    const session = usersSession.get(user.login);
    if (session) {
        return session;
    }
    return undefined;
}


function registerUser(session: Session, request: Message): Message {
    let { name, password } = JSON.parse(request.data);
    let err: boolean = false;
    let erTxt: string = '';
    if (name && password) {
        let user = getUser(name);
        if (user) {
            if (!checkPassword(name, password)) {
                err = true;
                erTxt = 'Authentication failed.';
            }
            else {
                let userSession = getUserSession(user);
                if (userSession) {
                    if (session.id === userSession.id) {
                        erTxt = 'Repeated registeration.';
                    }
                    else {
                        erTxt = 'Already registered in another session.'
                        err = true;
                    }
                }
                else {
                    session.user = user;
                    usersSession.set(user.login, session);
                    console.log(`user [${user.login}] was registered, session is [${session.id}]`);
                }
            }
        }
        else {
            user = new User(name, password);
            addUser(user);
            session.user = user;
            usersSession.set(user.login, session);
            console.log(`user [${user.login}] was added, session is [${session.id}]`);
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
        if (room.users.length === 1) {
            data.push(room.toJSON());
        }
    });

    return new Message('update_room', data, 'all');
}
function createRoom(session: Session, request: Message): Message {
    let err: boolean = true;
    let erTxt: string = 'Unable to create a room';
    const user = session.user;
    if (user) {
        const id = roomId++;
        const newRooms = new Room(id);
        newRooms.addUser(user);
        rooms.add(newRooms);
        roomById.set(id, newRooms);
        const res = getAvaliableRooms();
        res.rcpt = 'all';
        return res;
    }

    return new Message(request.type, {
        error: err,
        errorText: erTxt,
    }, 'all');
}
function updateWinners(winner: string = ''): Message {
    if (winner.length) {
        let wins = winnersMap.get(winner) || 0;
        wins++;
        winnersMap.set(winner, wins);
    }
    let data: any[] = [];

    winnersMap.forEach((v, k) => {
        data.push({ name: k, wins: v });
    });
    data.sort((a, b) => { return (b.wins - a.wins) });

    return new Message('update_winners', data, 'all');
}
function addUsersToRoom(session: Session, request: Message): Message[] {
    let err: boolean = true;
    let erTxt: string = 'Unable to add user to the room';
    const user = session.user;
    const data = JSON.parse(request.data);
    const roomIds = data.indxRoom;
    const resps = new Array<Message>;
    if (user && roomIds) {
        const room = roomById.get(roomId);
        if (room) {
            if (room.users.length === 1 && room.users[0].user.login != user.login) {
                room.addUser(user);
                resps.push(getAvaliableRooms());
                resps.push(new Message(
                    'create_game', { idGame: roomId, iduser: 1 }
                ));
                resps.push(new Message(
                    'create_game', { idGame: roomId, iduser: 0 }, room.users[0].user.login
                ));
            }
        }
    }

    return resps;
}
function win(room: Room, winner: number): Message[] {
    const resp = new Array<Message>;
    if (room && room.userNumInState(UserState.READY) === 2) {
        resp.push(new Message('finish', {
            winUser: winner
        }, room.users[0].user.login));
        resp.push(new Message('finish', {
            winUser: winner
        }, room.users[1].user.login));
        rooms.delete(room);
        resp.push(getAvaliableRooms());
        resp.push(updateWinners(room.users[winner].user.login));
    }
    return resp;
}
function sendMess(wss: WebSocketServer, ws: WebSocket, msgs: Message[]) {
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
                const session = usersSession.get(msg.rcpt);
                if (session) {
                    if (session.ws.readyState === WebSocket.OPEN) {
                        session.ws.send(str);
                    }
                }
                break;
        }
    });
}

export function processServer(session: Session, request: Message): Message[] {
    let response = new Array<Message>;

    switch (request.type) {
        case "reg":
            response.push(registerUser(session, request));
            response.push(getAvaliableRooms());
            response.push(updateWinners());
            break;
        case "create_room":
            response.push(createRoom(session, request));
            break;
        case "add_user_to_room":
            addUsersToRoom(session, request).forEach(resp => {
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
    const session: Session = new Session(uuid.v4(), ws, StateSession.OPEN);
    sessionsMap.add(session);
    console.log(`Created session [${session}]`);

    ws.on('message', (message: string) => {
        console.log(`Session is [${session.id}]`);
        try {
            console.log('->\nRequest:', JSON.parse(message));
            const msg = Message.fromJson(JSON.parse(message));
            let response: Message[] = processServer(session, msg);
            sendMess(wss, ws, response);
        } catch (error) {
            console.log(error);
        }
    });

    ws.on('close', () => {
        console.log('Connection closed');
        const user = session.user;
        if (user) {
            usersSession.delete(user.login);
            rooms.forEach(room => {
                room.users.forEach((p, i) => {
                    if (p.user && p.user.login === user.login) {
                        const activeuser = i > 0 ? 0 : 1;
                        sendMess(wss, ws, win(room, activeuser));
                    }
                });
            });
        }
        sessionsMap.delete(session);
    });

    ws.send(Message.fromJson({ type: "connected", data: { session: session.id }, id: 0 }).toString());
});

