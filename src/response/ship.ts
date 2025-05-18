export enum ShipState {
    NONE,
    HEALTY,
    HIT,
    KILLED,
}


export class Ship {
    type: string;
    start_x: number;
    start_y: number;
    end_x: number;
    end_y: number;
    state: number;
    length: number;
    direction: boolean;
    hits: number;

    constructor(pos_x: number, pos_y: number, direction: boolean, type: string, length: number = 1) {
        this.start_x = pos_x;
        this.start_y = pos_y;
        if (direction === true) {
            this.end_x = pos_x;
            this.end_y = pos_y + length - 1;
        }
        else {
            this.end_x = pos_x + length - 1;
            this.end_y = pos_y;
        }
        this.type = type;
        this.length = length;
        this.state = ShipState.HEALTY;
        this.direction = direction;
        this.hits = 0;
    }

    toJson(): any {
        return { position: { x: this.start_x, y: this.start_y }, direction: this.direction, length: this.length, type: this.type };
    }

    static fromJson(json: any): Ship {
        const { position, direction, type, length } = json;
        const { x, y } = position;
        return new Ship(x, y, direction, type, length);
    }
};
