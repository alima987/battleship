import { Ship, ShipState } from "./ship";

export class FieldDiff {
    x: number;
    y: number;
    val: number;

    constructor(x: number, y: number, val: number) {
        this.x = x;
        this.y = y;
        this.val = val;
    }
}


export class GameField {
    field: number[];
    ships: Ship[];
    shipsByType: Map<string, number>;

    constructor() {
        this.field = new Array<number>;
        for (let index = 0; index < 100; index++) {
            this.field.push(0); 

        }
        this.ships = new Array<Ship>;
        this.shipsByType = new Map<string, number>;
    }

    addShip(ship: Ship): boolean {
        this.ships.push(ship);
        let shipNum = this.shipsByType.get(ship.type) || 0;
        shipNum++;
        this.shipsByType.set(ship.type, shipNum);
        for (let x = ship.start_x; x <= ship.end_x; x++) {
            for (let y = ship.start_y; y <= ship.end_y; y++) {
                this.field[x + y * 10] = 1;
            }
        }
        return true;
    }

    getShipsAsJson() {
        const ships = new Array<{ position: { x: number, y: number }, direction: boolean, length: number, type: string }>;
        this.ships.forEach(ship => {
            ships.push(ship.toJson());
        });
        return ships;
    }
};