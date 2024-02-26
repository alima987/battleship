import { Ship, ShipState } from "./Ship";


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

    checkShipHit(x: number, y: number): FieldDiff[] {
        let res = 4;
        let diff = new Array<FieldDiff>;
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
            res = this.field[x + y * 10];
            if (res === 1) {
                const ship = this.ships.find((s) => {
                    return (s.start_x <= x && x <= s.end_x && s.start_y <= y && y <= s.end_y);
                });
                if (ship && ship.hits < ship.length) {
                    ship.hits++;
                    this.field[x + y * 10] = 2;
                    if (ship.hits === ship.length) {
                        res = 3;
                        ship.state = ShipState.KILLED;
                        diff.push(...this.getFieldsDiffs4KilledShip(ship));
                    }
                    else {
                        res = 2;
                        ship.state = ShipState.HIT;
                        diff.push(new FieldDiff(x, y, 2));
                    }
                }
            }
            else if (res === 0) {
                this.field[x + y * 10] = 4;
                diff.push(new FieldDiff(x, y, 4));
            }
            else {
                diff.push(new FieldDiff(x, y, res));
            }
        }
        else {
            diff.push(new FieldDiff(x, y, 4));
        }

        return diff;
    }


    getFieldsDiffs4KilledShip(ship: Ship): FieldDiff[] {
        const res = new Array<FieldDiff>;
        let sx = ship.start_x - 1;
        let sy = ship.start_y - 1;
        let ex = ship.end_x + 1;
        let ey = ship.end_y + 1;
        if (sx < 0) sx = 0;
        if (sy < 0) sy = 0;
        if (ex > 9) ex = 9;
        if (ey > 9) ey = 9;
        for (let x = sx; x <= ex; x++) {
            for (let y = sy; y <= ey; y++) {
                let cur = this.field[x + y * 10];
                if (cur === 0) {
                    res.push(new FieldDiff(x, y, 4));
                    this.field[x + y * 10] = 4;
                }
                else if (cur === 2) {
                    res.push(new FieldDiff(x, y, 3));
                    this.field[x + y * 10] = 3;
                }
            }
        }
        res.sort((a, b) => { return (a.val - b.val); });

        return res;
    }



    numShipsInState(state: ShipState): number {
        let num = 0;
        this.ships.forEach(ship => {
            if (ship.state === state) {
                num++;
            }
        });

        return num;
    }

    printField() {
        console.log("____________");
        for (let x = 0; x < 10; x++) {
            let str = "|";
            for (let y = 0; y < 10; y++) {
                str = str + this.field[x * 10 + y];
            }
            console.log(str + "|");
        }
        console.log("~~~~~~~~~~~~");
    }


    getShipsAsJson() {
        const ships = new Array<{ position: { x: number, y: number }, direction: boolean, length: number, type: string }>;
        this.ships.forEach(ship => {
            ships.push(ship.toJson());
        });
        return ships;
    }
};
