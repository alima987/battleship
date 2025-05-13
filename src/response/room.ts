export class Room {
    id: string;
    player_id: string;

    constructor(id: string, player_id: string) {
        this.id = id
        this.player_id = player_id
    }
}