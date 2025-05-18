import { FieldDiff, GameField } from "./game";
import { Player } from "./player";
import { Ship, ShipState } from "./ship";

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
        this.shipsPlacedCount = 0;
        this.gameField = new GameField();
    }
}
export class Room {
    id: number;
    players: Array<PlayerInRoom>
    player_id: number;

    constructor(id: number) {
        this.id = id
        this.players = new Array<PlayerInRoom>;
        this.player_id = 0
    }
    addPlayer(newPlayer: Player) {
      let indx = this.players.findIndex((el) => el.player.login === newPlayer.login)
      if (indx < 0) {
        if (this.players.length < 2) {
            const player = new PlayerInRoom(newPlayer, this.players.length)
            this.players.push(player)
            indx = this.players.length - 1
            return true
        }
      }
      return false
    }
    addShips(playerIdx: number, ships: Array<{ poistion: { x: number, y: number }, type: string, length: number }>): boolean {
      const player = this.players[playerIdx]
      if (player) { 
        const field = player.gameField
        ships.forEach(el => {
            const ship = Ship.fromJson(el)
            if (!field.addShip(ship)) return false
        })
        player.state = PlayerState.READY;
        return true
      }
      return false
    }
    attack(playerIdx: number, x: number, y: number): FieldDiff[] {
        let idx: number = 1;
        if (playerIdx > 0) {
            idx = 0;
        }

        return this.players[idx].gameField.checkShipHit(x, y);
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
             roomUsers: new Array<{ name: string, index: number | string }>
        }
        this.players.forEach((el, i) => {
            let user = {
                name: el.player.login,
                index: i
            }
            json.roomUsers.push(user)
        })
        return json
    }
}