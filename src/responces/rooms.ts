import { User } from "./user";
import { Game, GameField } from "./game";
import { Ship, StateShip } from "./ship";
class userInRoom {
    user: User;
    idx: number;
    state: UserState;
    shipsPlacedCount: number;
    game: Game;

    constructor(user: User, idx: number, state: UserState = UserState.CONNECTED) {
        this.user = user;
        this.idx = idx;
        this.state = state;
        this.shipsPlacedCount = 0;
        this.game = new Game();
    }
}
export enum UserState {
    NONE,
    CONNECTED,
    READY,
    INGAME,
    DISCONECTED,
    WON,
    LOOSE
}
export class Room {
    id: number;
    users: Array<userInRoom>;
    activeuserIdx: number;

    constructor(id: number) {
        this.id = id;
        this.users = new Array<userInRoom>;
        this.activeuserIdx = 0;
    }
    addUser(newUser: User): boolean {
        let idx = this.users.findIndex(el => { el.user.login === newUser.login; });
        if (idx < 0) {
            if (this.users.length < 2) {
                const user = new userInRoom(newUser, this.users.length);
                this.users.push(user);
                const idx = this.users.length - 1;
                return true;
            }
        }
        return false;
    }
    userNumInState(state: UserState): number {
        let num = 0;
        this.users.forEach(user => {
            if (user.state === state) {
                num++;
            }
        });
        return num;
    }
    addRoomShip(userIdx: number, ships: Array<{ poistion: { x: number, y: number }, type: string, length: number }>): boolean {
        const user = this.users[userIdx];
        if (user) {
            const field = user.game;
            ships.forEach(element => {
                const ship = Ship.fromJson(element);
                if (!field.addGameShip(ship)) return false;
            });
            user.state = UserState.READY;
            return true;
        }
        return false;
    }
    attack(userIdx: number, x: number, y: number): GameField[] {
        let idx: number = 1;
        if (userIdx > 0) {
            idx = 0;
        }

        return this.users[idx].game.getShipHit(x, y);
    }
    isEndGame(userIdx: number): boolean {
        let idx: number = 1;
        if (userIdx > 0) {
            idx = 0;
        }
        const numShipKilled = this.users[idx].game.shipNumState(StateShip.KILLED);

        return numShipKilled === this.users[idx].game.ship.length ? true : false;
    }
    getRandomAttack(userIdx: number): { x: number, y: number } {
        let pnt = Math.floor(Math.random() * 99);
        let dir = Math.round(Math.random()) == 1 ? 1 : -1;
        console.log("Random index: " + pnt);
        console.log("Random direction: " + dir);
        const field = this.users[userIdx].game.field;
        let idx = pnt;
        while (field[idx] != 0 && idx < 99 && idx > 0) {
            idx = idx + dir;
        }
        if (field[idx] != 0) {
            let idx = pnt;
            while (field[idx] != 0 && idx < 99 && idx > 0) {
                idx = idx - dir;
            }
        }
        const y = Math.floor(idx / 10);
        const x = idx % 10;
        console.log(`{ x: ${x}, y: ${y} }`);

        return { x: x, y: y };
    }

    toJSON() {
        let json = {
            roomId: this.id,
            roomUsers: new Array<{ name: string, index: number }>
        };

        this.users.forEach((elm, index) => {
            let user = {
                name: elm.user.login,
                index: index
            };
            json.roomUsers.push(user);
        });
        return json;
    }
}