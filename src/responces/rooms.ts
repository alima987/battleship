import { Player } from "./user";
import { GameField } from "./game";
import { Ship, ShipState } from "./Ship";
import { FieldDiff } from "./game";


export enum PlayerState {
    NONE,
    CONNECTED,
    READY,
    INGAME,
    DISCONECTED,
    WON,
    LOOSE
}

class PlayerInRoom {
    player: Player;
    idx: number;
    state: PlayerState;
    shipsPlacedCount: number;
    gameField: GameField;

    constructor(player: Player, idx: number, state: PlayerState = PlayerState.CONNECTED) {
        this.player = player;
        this.idx = idx;
        this.state = state;
        this.gameField = new GameField();
        this.shipsPlacedCount = 0;
    }
}

export class Room {
    id: number;
    players: Array<PlayerInRoom>;
    activePlayerIdx: number;

    constructor(id: number) {
        this.id = id;
        this.players = new Array<PlayerInRoom>;
        this.activePlayerIdx = 0;
    }

    addPlayer(newPlayer: Player): boolean {
        let idx = this.players.findIndex(el => { el.player.login === newPlayer.login; });
        if (idx < 0) {
            if (this.players.length < 2) {
                const player = new PlayerInRoom(newPlayer, this.players.length);
                this.players.push(player);
                const idx = this.players.length - 1;
                return true;
            }
        }
        return false;
    }

    addShips(playerIdx: number, ships: Array<{ poistion: { x: number, y: number }, type: string, length: number }>): boolean {
        const player = this.players[playerIdx];
        if (player) {
            const field = player.gameField;
            ships.forEach(element => {
                const ship = Ship.fromJson(element);
                if (!field.addShip(ship)) return false;
            });
            player.state = PlayerState.READY;
            return true;
        }
        return false;
    }


    attack(playerIdx: number, x: number, y: number): FieldDiff[] {
        let idx: number = 1;
        if (playerIdx > 0) {
            idx = 0;
        }

        return this.players[idx].gameField.checkShipHit(x, y);
    }

    getRndXY4Attack(playerIdx: number): { x: number, y: number } {
        let pnt = Math.floor(Math.random() * 99);
        let dir = Math.round(Math.random()) == 1 ? 1 : -1;
        console.log("Random index: " + pnt);
        console.log("Random direction: " + dir);
        const field = this.players[playerIdx].gameField.field;
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


    isGameOver(playerIdx: number): boolean {
        let idx: number = 1;
        if (playerIdx > 0) {
            idx = 0;
        }

        const numShipsKilled = this.players[idx].gameField.numShipsInState(ShipState.KILLED);

        return numShipsKilled === this.players[idx].gameField.ships.length ? true : false;
    }


    numPlayersInState(state: PlayerState): number {
        let num = 0;
        this.players.forEach(player => {
            if (player.state === state) {
                num++;
            }
        });

        return num;
    }

    toJSON() {
        let json = {
            roomId: this.id,
            roomUsers: new Array<{ name: string, index: number }>
        };

        this.players.forEach((elm, index) => {
            let user = {
                name: elm.player.login,
                index: index
            };
            json.roomUsers.push(user);
        });
        return json;
    }
};
