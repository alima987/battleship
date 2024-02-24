import * as http from 'http';
import { WebSocketServer } from 'ws';
import { User } from "../responces/user";
import { Session, Message } from '../responces/session-message';
import { Room } from '../responces/rooms';
export const server = http.createServer();
const wss = new WebSocketServer({ server });
let roomId = 1;
const users = new Map<string, User>();
const usersSession = new Map<string, Session>();
const rooms = new Set<Room>();
const roomById = new Map<number, Room>();
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
export function processServer(session: Session, request: Message): Message[] {
    let response = new Array<Message>;

    switch (request.type) {
        case "reg":
            response.push(registerUser(session, request));
            response.push(getAvaliableRooms());
            break;
        case "create_room":
            response.push(createRoom(session, request));
            break;
        default:
            response.push(new Message("error", { 'error': true, 'errorText': "Unknow message type" }));
            break;
    }

    return response;
}

