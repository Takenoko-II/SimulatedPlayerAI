import { Vector2, Vector3 } from "@minecraft/server";

function isValidNumber(x: unknown): x is number {
    return typeof x === "number" && !Number.isNaN(x);
}

export class Vector3Builder implements Vector3 {
    private __x__: number;
    private __y__: number;
    private __z__: number;

    public constructor(x: number, y: number, z: number) {
        if (!(isValidNumber(x) && isValidNumber(y) && isValidNumber(z))) {
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
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__x__ = value;
    }

    public get y(): number {
        return this.__y__;
    }

    public set y(value: number) {
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__y__ = value;
    }

    public get z(): number {
        return this.__z__;
    }

    public set z(value: number) {
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__z__ = value;
    }

    public equals(other: Vector3): boolean {
        return this.__x__ === other.x
            && this.__y__ === other.y
            && this.__z__ === other.z;
    }

    public operate(callbackFn: (comopnent: number) => number): Vector3Builder;

    public operate(other: Vector3, callbackFn: (comopnent1: number, comopnent2: number) => number): Vector3Builder;

    public operate(a: Vector3 | ((comopnent: number) => number), b?: (comopnent1: number, comopnent2: number) => number): Vector3Builder {
        if (typeof a === "function" && b === undefined) {
            this.__x__ = a(this.__x__);
            this.__y__ = a(this.__y__);
            this.__z__ = a(this.__z__);
        }
        else if (Vector3Builder.isValidVector3(a) && typeof b === "function") {
            this.__x__ = b(this.__x__, a.x);
            this.__y__ = b(this.__y__, a.y);
            this.__z__ = b(this.__z__, a.z);
        }
        else {
            throw new TypeError();
        }
        return this;
    }

    public add(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return this.operate(other, (a, b) => a + b);
    }

    public subtract(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return this.add(Vector3Builder.from(other).clone().invert());
    }

    public scale(scalar: number): Vector3Builder {
        if (!isValidNumber(scalar)) {
            throw new TypeError();
        }

        return this.operate(component => component * scalar);
    }

    public divide(scalar: number): Vector3Builder {
        if (!isValidNumber(scalar)) {
            throw new TypeError();
        }

        if (scalar === 0) {
            throw new TypeError();
        }

        return this.operate(component => component / scalar);
    }

    public invert(): Vector3Builder {
        return this.scale(-1);
    }

    public dot(other: Vector3): number {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return this.__x__ * other.x + this.__y__ * other.y + this.__z__ * other.z;
    }

    public cross(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        const x1 = this.__x__;
        const y1 = this.__y__;
        const z1 = this.__z__;
        const x2 = other.x;
        const y2 = other.y;
        const z2 = other.z;

        return new Vector3Builder(
            y1 * z2 - z1 * y2,
            z1 * x2 - x1 * z2,
            x1 * y2 - y1 * x2
        );
    }

    public hadamard(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return this.clone().operate(other, (a, b) => a * b);
    }

    public length(): number;

    public length(length: number): Vector3Builder;

    public length(length?: number): number | Vector3Builder {
        if (length === undefined) {
            return Math.sqrt(this.dot(this));
        }
        else if (isValidNumber(length)) {
            const previous = this.length();

            if (previous === 0) {
                return this;
            }

            return this.operate(component => component / previous * length);
        }
        else {
            throw new TypeError();
        }
    }

    public normalize(): Vector3Builder {
        return this.length(1);
    }

    public getAngleBetween(other: Vector3): number {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        const cos: number = this.dot(other) / (this.length() * Vector3Builder.from(other).length());
        return Math.acos(cos) * 180 / Math.PI;
    }

    public getDistanceTo(other: Vector3): number {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return Math.hypot(
            this.__x__ - other.x,
            this.__y__ - other.y,
            this.__z__ - other.z
        );
    }

    public getDirectionTo(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return Vector3Builder.from(other).clone()
            .subtract(this)
            .normalize();
    }

    public project(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        const wrapped = Vector3Builder.from(other);

        return wrapped.clone().scale(
            wrapped.length() * this.length() / wrapped.length() * wrapped.length()
        );
    }

    public reject(other: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        return this.clone().subtract(this.project(other));
    }

    public reflect(normal: Vector3): Vector3Builder {
        if (!Vector3Builder.isValidVector3(normal)) {
            throw new TypeError();
        }

        const dot = this.dot(normal);

        return this.clone().operate(normal, (a, b) => a - 2 * dot * b);
    }

    public lerp(other: Vector3, t: number): Vector3Builder {
        if (!isValidNumber(t)) {
            throw new TypeError();
        }

        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        const linear = (a: number, b: number) => (1 - t) * a + t * b;

        return new Vector3Builder(
            linear(this.__x__, other.x),
            linear(this.__y__, other.y),
            linear(this.__z__, other.z)
        );
    }

    public slerp(other: Vector3, s: number): Vector3Builder {
        if (!isValidNumber(s)) {
            throw new TypeError();
        }

        if (!Vector3Builder.isValidVector3(other)) {
            throw new TypeError();
        }

        const angle = this.getAngleBetween(other) * Math.PI / 180;

        const p1 = Math.sin(angle * (1 - s)) / Math.sin(angle);
        const p2 = Math.sin(angle * s) / Math.sin(angle);

        const q1 = this.clone().scale(p1);
        const  q2 = Vector3Builder.from(other).clone().scale(p2);

        return q1.add(q2);
    }

    public clamp(min: Vector3, max: Vector3): Vector3Builder {
        if (!(Vector3Builder.isValidVector3(min) && Vector3Builder.isValidVector3(max))) {
            throw new TypeError();
        }

        const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

        this.__x__ = clamp(this.__x__, min.x, max.x);
        this.__y__ = clamp(this.__y__, min.y, max.y);
        this.__z__ = clamp(this.__z__, min.z, max.z);

        return this;
    }

    public clone(): Vector3Builder {
        return new Vector3Builder(this.__x__, this.__y__, this.__z__);
    }

    public format(format: string, digits: number): string {
        if (!isValidNumber(digits)) {
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
        const normalized = this.clone().normalize();

        return new TripleAxisRotationBuilder(
            -Math.atan2(normalized.__x__, normalized.__z__) * 180 / Math.PI,
            -Math.asin(normalized.__y__) * 180 / Math.PI,
            0
        );
    }

    public rotate(axis: Vector3, angle: number): Vector3Builder {
        if (!Vector3Builder.isValidVector3(axis)) {
            throw new TypeError();
        }

        const angleInRad = angle * Math.PI / 180;
        const sin = Math.sin(angleInRad);
        const cos = Math.cos(angleInRad);
        const { x, y, z } = axis;

        const matrix = [
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

        return new Vector3Builder(
            matrix[0][0] * this.x + matrix[0][1] * this.y + matrix[0][2] * this.z,
            matrix[1][0] * this.x + matrix[1][1] * this.y + matrix[1][2] * this.z,
            matrix[2][0] * this.x + matrix[2][1] * this.y + matrix[2][2] * this.z
        );
    }

    public isZero(): boolean {
        return this.equals(Vector3Builder.zero());
    }

    public asInterface(): Vector3 {
        return { x: this.x, y: this.y, z: this.z };
    }

    public static isValidVector3(value: unknown): value is Vector3 {
        if (typeof value !== "object" || value === null) return false;

        const x: unknown = value["x"];
        const y: unknown = value["y"];
        const z: unknown = value["z"];

        return typeof x === "number" && !Number.isNaN(x)
            && typeof y === "number" && !Number.isNaN(y)
            && typeof z === "number" && !Number.isNaN(z);
    }

    public static zero(): Vector3Builder {
        return new this(0, 0, 0);
    }

    public static forward(): Vector3Builder {
        return new this(0, 0, 1);
    }

    public static back(): Vector3Builder {
        return new this(0, 0, -1);
    }

    public static left(): Vector3Builder {
        return new this(1, 0, 0);
    }

    public static right(): Vector3Builder {
        return new this(-1, 0, 0);
    }

    public static up(): Vector3Builder {
        return new this(0, 1, 0);
    }

    public static down(): Vector3Builder {
        return new this(0, -1, 0);
    }

    public static filled(value: number): Vector3Builder {
        return new Vector3Builder(value, value, value);
    }

    public static from(vector3: Vector3): Vector3Builder {
        return new this(vector3.x, vector3.y, vector3.z);
    }

    public static min(a: Vector3, b: Vector3): Vector3Builder {
        return this.from(a).clone().operate(b, (a, b) => Math.min(a, b));
    }

    public static max(a: Vector3, b: Vector3): Vector3Builder {
        return this.from(a).clone().operate(b, (a, b) => Math.max(a, b));
    }
}

export class TripleAxisRotationBuilder implements Vector2 {
    private __yaw__: number;
    private __pitch__: number;
    private __roll__: number;

    public constructor(yaw: number, pitch: number, roll: number) {
        if (!(isValidNumber(yaw) && isValidNumber(pitch) && isValidNumber(roll))) {
            throw new TypeError();
        }

        this.__yaw__ = yaw;
        this.__pitch__ = pitch;
        this.__roll__ = roll;
    }

    public get x(): number {
        return this.pitch;
    }

    public set x(value) {
        this.pitch = value;
    } 

    public get y(): number {
        return this.yaw;
    }

    public set y(value) {
        this.yaw = value;
    }

    public get yaw(): number {
        return this.__yaw__;
    }

    public set yaw(value: number) {
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__yaw__ = value;
    }

    public get pitch(): number {
        return this.__pitch__;
    }

    public set pitch(value: number) {
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__pitch__ = value;
    }

    public get roll(): number {
        return this.__roll__;
    }

    public set roll(value: number) {
        if (!isValidNumber(value)) {
            throw new TypeError();
        }

        this.__roll__ = value;
    }

    public equals(other: Vector2): boolean {
        if (other instanceof TripleAxisRotationBuilder) {
            return this.__yaw__ === other.__yaw__
                && this.__pitch__ === other.__pitch__
                && this.__roll__ === other.__roll__;
        }
        else {
            return this.x === other.x
                && this.y === other.y;
        }
    }

    public operate(callbackFn: (comopnent: number) => number): TripleAxisRotationBuilder;

    public operate(other: Vector2, callbackFn: (comopnent1: number, comopnent2: number) => number): TripleAxisRotationBuilder;

    public operate(a: Vector2 | ((comopnent: number) => number), b?: (comopnent1: number, comopnent2: number) => number): TripleAxisRotationBuilder {
        if (typeof a === "function" && b === undefined) {
            this.__yaw__ = a(this.__yaw__);
            this.__pitch__ = a(this.__pitch__);
            this.__roll__ = a(this.__roll__);
        }
        else if (a instanceof TripleAxisRotationBuilder && typeof b === "function") {
            this.__yaw__ = b(this.__yaw__, a.__yaw__);
            this.__pitch__ = b(this.__pitch__, a.__pitch__);
            this.__roll__ = b(this.__roll__, a.__roll__);
        }
        else if (TripleAxisRotationBuilder.isValidVector2(a) && typeof b === "function") {
            this.__yaw__ = b(this.__yaw__, a.y);
            this.__pitch__ = b(this.__pitch__, a.x);
        }
        else {
            throw new TypeError();
        }
        return this;
    }

    public add(other: Vector2): TripleAxisRotationBuilder {
        if (!TripleAxisRotationBuilder.isValidVector2(other)) {
            throw new TypeError();
        }

        return this.operate(other, (a, b) => a + b);
    }

    public subtract(other: Vector2): TripleAxisRotationBuilder {
        if (!TripleAxisRotationBuilder.isValidVector2(other)) {
            throw new TypeError();
        }

        return this.add(TripleAxisRotationBuilder.from(other).clone().invert());
    }

    public scale(scalar: number): TripleAxisRotationBuilder {
        if (!isValidNumber(scalar)) {
            throw new TypeError();
        }

        return this.operate(component => component * scalar);
    }

    public divide(scalar: number): TripleAxisRotationBuilder {
        if (!isValidNumber(scalar)) {
            throw new TypeError();
        }

        if (scalar === 0) {
            throw new TypeError();
        }

        return this.operate(component => component / scalar);
    }

    public invert(): TripleAxisRotationBuilder {
        return this.scale(-1);
    }

    public clamp(min: TripleAxisRotationBuilder, max: TripleAxisRotationBuilder): TripleAxisRotationBuilder;

    public clamp(min: Vector2, max: Vector2): TripleAxisRotationBuilder;

    public clamp(min: Vector2, max: Vector2): TripleAxisRotationBuilder {
        if (!(TripleAxisRotationBuilder.isValidVector2(min) && TripleAxisRotationBuilder.isValidVector2(max))) {
            throw new TypeError();
        }

        const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

        this.x = clamp(this.x, min.x, max.x);
        this.y = clamp(this.y, min.y, max.y);

        if (min instanceof TripleAxisRotationBuilder && max instanceof TripleAxisRotationBuilder) {
            this.__roll__ = clamp(this.__roll__, min.__roll__, max.__roll__);
        }

        return this;
    }

    public clone(): TripleAxisRotationBuilder {
        return new TripleAxisRotationBuilder(this.__yaw__, this.__pitch__, this.__roll__);
    }

    public format(format: string, digits: number): string {
        if (!isValidNumber(digits)) {
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

    public isZero(): boolean {
        return this.equals(TripleAxisRotationBuilder.zero());
    }

    public asInterface(): Vector2 {
        return { x: this.x, y: this.y };
    }

    public static isValidVector2(value: unknown): value is Vector2 {
        if (typeof value !== "object" || value === null) return false;

        const x: unknown = value["x"];
        const y: unknown = value["y"];

        return typeof x === "number" && !Number.isNaN(x)
            && typeof y === "number" && !Number.isNaN(y);
    }

    public static zero(): TripleAxisRotationBuilder {
        return new this(0, 0, 0);
    }

    public static filled(value: number): TripleAxisRotationBuilder {
        return new this(value, value, value);
    }

    public static from(vector2: Vector2): TripleAxisRotationBuilder {
        return new this(vector2.y, vector2.x, 0);
    }
}

class RotatedLocalAxisProvider {
    private readonly __rotation__: TripleAxisRotationBuilder;

    public constructor(rotation: TripleAxisRotationBuilder) {
        this.__rotation__ = rotation.clone();
    }

    private rotate(vector3: Vector3Builder): Vector3Builder {
        const roll = this.__rotation__.roll * Math.PI / 180;
        const sin = Math.sin(roll);
        const cos = Math.cos(roll);
        const { x, y, z } = this.getZ();

        const matrix = [
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
        return this.rotate(this.getRawVertical());
    }

    public getY(): Vector3Builder {
        return this.rotate(this.getZ().clone().cross(this.getRawVertical()));
    }

    public getZ(): Vector3Builder {
        return this.__rotation__.getDirection3d();
    }
}
