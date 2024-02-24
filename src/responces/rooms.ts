import { User } from "./user";
class userInRoom {
    user: User;
    idx: number;
    state: UserState;
    shipsPlacedCount: number;

    constructor(user: User, idx: number, state: UserState = UserState.CONNECTED) {
        this.user = user;
        this.idx = idx;
        this.state = state;
        this.shipsPlacedCount = 0;
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