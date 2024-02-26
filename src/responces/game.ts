import { Ship } from "./ship";
export class Game {
    field: number[];
    ship: Ship[];
    shipType: Map<string, number>;

    constructor() {
        this.field = new Array<number>;
        for (let index = 0; index < 100; index++) {
            this.field.push(0);

        }
        this.ship = new Array<Ship>;
        this.shipType = new Map<string, number>;
    }
    addGameShip(ship: Ship): boolean {
        this.ship.push(ship);
        let shipNum = this.shipType.get(ship.type) || 0;
        shipNum++;
        this.shipType.set(ship.type, shipNum);
        for (let x = ship.start_x; x <= ship.end_x; x++) {
            for (let y = ship.start_y; y <= ship.end_y; y++) {
                this.field[x + y * 10] = 1;
            }
        }
        return true;
    }
    shipAsJson() {
        const ships = new Array<{ position: { x: number, y: number }, direction: boolean, length: number, type: string }>;
        this.ship.forEach(ship => {
            ships.push(ship.toJson());
        });
        return ships;
    }
}