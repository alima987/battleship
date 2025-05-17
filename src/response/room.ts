import { Player } from "./player";

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

    constructor(player: Player, idx: number, state: PlayerState = PlayerState.CONNECTED) {
        this.player = player;
        this.idx = idx;
        this.state = state;
        this.shipsPlacedCount = 0;
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