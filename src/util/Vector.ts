import { Vector2, Vector3 } from "@minecraft/server";

function isNumber(x: unknown): x is number {
    return typeof x === "number" && !Number.isNaN(x);
}

export class Vector3Builder implements Vector3 {
    private __x__: number;
    private __y__: number;
    private __z__: number;

    public constructor(x: number, y: number, z: number) {
        if (!(isNumber(x) && isNumber(y) && isNumber(z))) {
            throw new TypeError();
        }

        this.__x__ = x;
        this.__y__ = y;
        this.__z__ = z;
    }

    public get x(): number {
        return this.__x__;
    }

    public set x(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__x__ = value;
    }

    public get y(): number {
        return this.__y__;
    }

    public set y(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__y__ = value;
    }

    public get z(): number {
        return this.__z__;
    }

    public set z(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__z__ = value;
    }

    public equals(other: Vector3Builder): boolean {
        return this.__x__ === other.__x__
            && this.__y__ === other.__y__
            && this.__z__ === other.__z__;
    }

    public operate(callbackFn: (comopnent: number) => number): Vector3Builder;

    public operate(other: Vector3Builder, callbackFn: (comopnent1: number, comopnent2: number) => number): Vector3Builder;

    public operate(a: Vector3Builder | ((comopnent: number) => number), b?: (comopnent1: number, comopnent2: number) => number): Vector3Builder {
        if (typeof a === "function" && b === undefined) {
            a(this.__x__);
            a(this.__y__);
            a(this.__z__);
        }
        else if (a instanceof Vector3Builder && typeof b === "function") {
            b(this.__x__, a.__x__);
            b(this.__y__, a.__y__);
            b(this.__z__, a.__z__);
        }
        else {
            throw new TypeError();
        }
        return this;
    }

    public add(other: Vector3Builder): Vector3Builder {
        return this.operate(other, (a, b) => a + b);
    }

    public subtract(other: Vector3Builder): Vector3Builder {
        return this.add(other.clone().inverted());
    }

    public scale(scale: number): Vector3Builder {
        if (!isNumber(scale)) {
            throw new TypeError();
        }

        return this.operate(component => component * scale);
    }

    public inverted(): Vector3Builder {
        return this.scale(-1);
    }

    public dot(other: Vector3Builder): number {
        return this.__x__ * other.__x__ + this.__y__ * other.__y__ + this.__z__ * other.__z__;
    }

    public cross(other: Vector3Builder): Vector3Builder {
        const x1 = this.__x__;
        const y1 = this.__y__;
        const z1 = this.__z__;
        const x2 = other.__x__;
        const y2 = other.__y__;
        const z2 = other.__z__;

        return new Vector3Builder(
            y1 * z2 - z1 * y2,
            z1 * x2 - x1 * z2,
            x1 * y2 - y1 * x2
        );
    }

    public length(): number;

    public length(length: number): Vector3Builder;

    public length(length?: number): number | Vector3Builder {
        if (length === undefined) {
            return Math.sqrt(this.dot(this));
        }
        else if (isNumber(length)) {
            const previous = this.length();
            return this.operate(component => component / previous * length);
        }
        else {
            throw new TypeError();
        }
    }

    public normalized(): Vector3Builder {
        return this.length(1);
    }

    public getAngleBetween(other: Vector3Builder): number {
        const cos: number = this.dot(other) / (this.length() * other.length());
        return Math.acos(cos) * 180 / Math.PI;
    }

    public getDistanceBetween(other: Vector3Builder): number {
        return Math.hypot(
            this.__x__ - other.__x__,
            this.__y__ - other.__y__,
            this.__z__ - other.__z__
        );
    }

    public getDirectionTo(other: Vector3Builder): Vector3Builder {
        return other.clone()
            .subtract(this)
            .normalized();
    }

    public projection(other: Vector3Builder): Vector3Builder {
        return other.clone().scale(
            other.length() * this.length() / other.length() * other.length()
        );
    }

    public rejection(other: Vector3Builder): Vector3Builder {
        return this.clone().subtract(this.projection(other));
    }

    public lerp(other: Vector3Builder, t: number): Vector3Builder {
        if (!isNumber(t)) {
            throw new TypeError();
        }

        const linear = (a: number, b: number) => (1 - t) * a + t * b;

        return new Vector3Builder(
            linear(this.__x__, other.__x__),
            linear(this.__y__, other.__y__),
            linear(this.__z__, other.__z__)
        );
    }

    public slerp(other: Vector3Builder, s: number): Vector3Builder {
        if (!isNumber(s)) {
            throw new TypeError();
        }

        const angle = this.getAngleBetween(other) * Math.PI / 180;

        const p1 = Math.sin(angle * (1 - s)) / Math.sin(angle);
        const p2 = Math.sin(angle * s) / Math.sin(angle);

        const q1 = this.clone().scale(p1);
        const  q2 = other.clone().scale(p2);

        return q1.add(q2);
    }

    public clone(): Vector3Builder {
        return new Vector3Builder(this.__x__, this.__y__, this.__z__);
    }

    public format(format: string, digits: number): string {
        if (!isNumber(digits)) {
            throw new TypeError();
        }
        else if (digits < 0 || digits > 20) {
            throw new RangeError();
        }

        const cx = this.__x__.toFixed(digits);
        const cy = this.__y__.toFixed(digits);
        const cz = this.__z__.toFixed(digits);

        return format
            .replace(/\$x/g, cx)
            .replace(/\$y/g, cy)
            .replace(/\$z/g, cz)
            .replace("$c", cx)
            .replace("$c", cy)
            .replace("$c", cz)
            .replace(/\$c/g, "");
    }

    public toString(): string {
        return this.format("($x, $y, $z)", 1);
    }

    public getRotation2d(): TripleAxisRotationBuilder {
        const normalized = this.clone().normalized();

        return new TripleAxisRotationBuilder(
            -Math.atan2(normalized.__x__, normalized.__z__) * 180 / Math.PI,
            -Math.asin(normalized.__y__) * 180 / Math.PI,
            0
        );
    }

    public static zero(): Vector3Builder {
        return new Vector3Builder(0, 0, 0);
    }

    public static from(vector3: Vector3): Vector3Builder {
        return new Vector3Builder(vector3.x, vector3.y, vector3.z);
    }

    public static min(a: Vector3Builder, b: Vector3Builder): Vector3Builder {
        return a.clone().operate(b, (a, b) => Math.min(a, b));
    }

    public static max(a: Vector3Builder, b: Vector3Builder): Vector3Builder {
        return a.clone().operate(b, (a, b) => Math.max(a, b));
    }
}

export class TripleAxisRotationBuilder implements Vector2 {
    private __yaw__: number;
    private __pitch__: number;
    private __roll__: number;

    public constructor(yaw: number, pitch: number, roll: number) {
        if (!(isNumber(yaw) && isNumber(pitch) && isNumber(roll))) {
            throw new TypeError();
        }

        this.__yaw__ = yaw;
        this.__pitch__ = pitch;
        this.__roll__ = roll;
    }

    public get x(): number {
        return this.yaw;
    }

    public set x(value) {
        this.yaw = value;
    } 

    public get y(): number {
        return this.pitch;
    }

    public set y(value) {
        this.pitch = value;
    }

    public get yaw(): number {
        return this.__yaw__;
    }

    public set yaw(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__yaw__ = value;
    }

    public get pitch(): number {
        return this.__pitch__;
    }

    public set pitch(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__pitch__ = value;
    }

    public get roll(): number {
        return this.__roll__;
    }

    public set roll(value: number) {
        if (!isNumber(value)) {
            throw new TypeError();
        }

        this.__roll__ = value;
    }

    public operate(callbackFn: (comopnent: number) => number): TripleAxisRotationBuilder;

    public operate(other: TripleAxisRotationBuilder, callbackFn: (comopnent1: number, comopnent2: number) => number): TripleAxisRotationBuilder;

    public operate(a: TripleAxisRotationBuilder | ((comopnent: number) => number), b?: (comopnent1: number, comopnent2: number) => number): TripleAxisRotationBuilder {
        if (typeof a === "function" && b === undefined) {
            a(this.__yaw__);
            a(this.__pitch__);
            a(this.__roll__);
        }
        else if (a instanceof TripleAxisRotationBuilder && typeof b === "function") {
            b(this.__yaw__, a.__yaw__);
            b(this.__pitch__, a.__pitch__);
            b(this.__roll__, a.__roll__);
        }
        else {
            throw new TypeError();
        }
        return this;
    }

    public add(other: TripleAxisRotationBuilder): TripleAxisRotationBuilder {
        return this.operate(other, (a, b) => a + b);
    }

    public subtract(other: TripleAxisRotationBuilder): TripleAxisRotationBuilder {
        return this.add(other.clone().inverted());
    }

    public scale(scale: number): TripleAxisRotationBuilder {
        if (!isNumber(scale)) {
            throw new TypeError();
        }

        return this.operate(component => component * scale);
    }

    public inverted(): TripleAxisRotationBuilder {
        return this.scale(-1);
    }

    public clone(): TripleAxisRotationBuilder {
        return new TripleAxisRotationBuilder(this.__yaw__, this.__pitch__, this.__roll__);
    }

    public format(format: string, digits: number): string {
        if (!isNumber(digits)) {
            throw new TypeError();
        }
        else if (digits < 0 || digits > 20) {
            throw new RangeError();
        }

        const cx = this.__yaw__.toFixed(digits);
        const cy = this.__pitch__.toFixed(digits);
        const cz = this.__roll__.toFixed(digits);

        return format
            .replace(/\$yaw/g, cx)
            .replace(/\$pitch/g, cy)
            .replace(/\$roll/g, cz)
            .replace("$c", cx)
            .replace("$c", cy)
            .replace("$c", cz)
            .replace(/\$c/g, "");
    }

    public toString(): string {
        return this.format("($yaw, $pitch, $roll)", 1);
    }

    public getDirection3d(): Vector3Builder {
        return new Vector3Builder(
            -Math.sin(this.__yaw__ * Math.PI / 180) * Math.cos(this.__pitch__ * Math.PI / 180),
            -Math.sin(this.__pitch__ * Math.PI / 180),
            Math.cos(this.__yaw__ * Math.PI / 180) * Math.cos(this.__pitch__ * Math.PI / 180)
        );
    }

    public getLocalAxisProvider(): RotatedLocalAxisProvider {
        return new RotatedLocalAxisProvider(this);
    }

    public static zero(): TripleAxisRotationBuilder {
        return new TripleAxisRotationBuilder(0, 0, 0);
    }

    public static from(vector2: Vector2): TripleAxisRotationBuilder {
        return new TripleAxisRotationBuilder(vector2.x, vector2.y, 0);
    }
}

class RotatedLocalAxisProvider {
    private __rotation__: TripleAxisRotationBuilder;

    public constructor(rotation: TripleAxisRotationBuilder) {
        this.__rotation__ = rotation.clone();
    }

    private getRotationMatrix(): number[][] {
        const roll = this.__rotation__.roll * Math.PI / 180;
        const sin = Math.sin(roll);
        const cos = Math.cos(roll);
        const { x, y, z } = this.getZ();
        return [
            [
                cos + x * x * (1 - cos),
                x * y * (1 - cos) - z * sin,
                x * z * (1 - cos) + y * sin
            ],
            [
                y * x * (1 - cos) + z * sin,
                cos + y * y * (1 - cos),
                y * z * (1 - cos) - x * sin
            ],
            [
                z * x * (1 - cos) - y * sin,
                z * y * (1 - cos) + x * sin,
                cos + z * z * (1 - cos)
            ]
        ];
    }

    private rotateVector(vector3: Vector3Builder): Vector3Builder {
        const matrix = this.getRotationMatrix();
        return new Vector3Builder(
            matrix[0][0] * vector3.x + matrix[0][1] * vector3.y + matrix[0][2] * vector3.z,
            matrix[1][0] * vector3.x + matrix[1][1] * vector3.y + matrix[1][2] * vector3.z,
            matrix[2][0] * vector3.x + matrix[2][1] * vector3.y + matrix[2][2] * vector3.z
        );
    }

    private getRawVertical(): Vector3Builder {
        const { x, z } = this.getZ();
        return new Vector3Builder(z, 0, -x);
    }

    public getX(): Vector3Builder {
        return this.rotateVector(this.getRawVertical());
    }

    public getY(): Vector3Builder {
        return this.rotateVector(this.getZ().clone().cross(this.getRawVertical()));
    }

    public getZ(): Vector3Builder {
        return this.__rotation__.getDirection3d();
    }
}