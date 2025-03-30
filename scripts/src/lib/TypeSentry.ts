export abstract class TypeModel<T> {
    public constructor() {}

    public abstract test(x: unknown): x is T;

    public cast(x: unknown): T {
        if (this.test(x)) {
            return x;
        }
        else {
            throw new TypeSentryError("値のキャストに失敗しました: 期待された型に一致しません");
        }
    }
}

abstract class PrimitiveModel<T extends boolean | number | bigint | string | symbol | null | undefined> extends TypeModel<T> {
    protected constructor() {
        super();
    }

    public override test(x: unknown): x is T {
        return sentry.boolean.test(x)
            || sentry.number.test(x)
            || sentry.bigint.test(x)
            || sentry.string.test(x)
            || sentry.null.test(x)
            || sentry.undefined.test(x)
            || sentry.symbol.test(x);
    }
}

class BooleanModel extends PrimitiveModel<boolean> {
    public override test(x: unknown): x is boolean {
        return typeof x === "boolean";
    }

    public static readonly INSTANCE: BooleanModel = new this();
}

class NumberModel extends PrimitiveModel<number> {
    public override test(x: unknown): x is number {
        return typeof x === "number";
    }

    public nonNaN(): NumberModel {
        const that = this;

        return new (class extends NumberModel {
            public test(x: unknown): x is number {
                return that.test(x) && !Number.isNaN(x);
            }
        })();
    }

    public static readonly INSTANCE: NumberModel = new this();
}

class IntModel extends NumberModel {
    public test(x: unknown): x is number {
        return super.test(x) && Number.isInteger(x);
    }

    public nonNaN(): IntModel {
        const that = this;

        return new (class extends IntModel {
            public test(x: unknown): x is number {
                return that.test(x) && !Number.isNaN(x);
            }
        })();
    }

    public static readonly INSTANCE: IntModel = new this();
}

class BigIntModel extends PrimitiveModel<bigint> {
    public override test(x: unknown): x is bigint {
        return typeof x === "bigint";
    }

    public static readonly INSTANCE: BigIntModel = new this();
}

interface LengthRange {
    readonly min?: number;

    readonly max?: number;
};

class StringModel extends PrimitiveModel<string> {
    public override test(x: unknown): x is string {
        return typeof x === "string";
    }

    public withLength(range: LengthRange): StringModel {
        const min = range.min === undefined ? 0 : range.min;
        const max = range.max === undefined ? Infinity : range.max;

        if (min > max || min < 0) {
            throw TypeError("無効な範囲です");
        }

        const that = this;

        return new (class extends StringModel {
            public test(x: unknown): x is string {
                return that.test(x) && (min <= x.length && x.length <= max);
            }
        })();
    }

    public withPattern(pattern: RegExp): StringModel {
        const that = this;

        return new (class extends StringModel {
            public test(x: unknown): x is string {
                return that.test(x) && new RegExp(pattern).test(x);
            }
        })();
    }

    public static readonly INSTANCE: StringModel = new this();
}

class NullModel extends PrimitiveModel<null> {
    public override test(x: unknown): x is null {
        return x === null;
    }

    public static readonly INSTANCE: NullModel = new this();
}

class UndefinedModel extends PrimitiveModel<undefined> {
    public override test(x: unknown): x is undefined {
        return x === undefined;
    }

    public static readonly INSTANCE: UndefinedModel = new this();
}

class AnyModel extends TypeModel<any> {
    private constructor() {
        super();
    }

    public test(x: unknown): x is any {
        return true;
    }

    public static readonly INSTANCE: AnyModel = new this();
}

class NeverModel extends TypeModel<never> {
    public test(x: unknown): x is never {
        return false;
    }

    public static readonly INSTANCE: NeverModel = new this();
}

class VoidModel extends TypeModel<void> {
    public test(x: unknown): x is void {
        return x === undefined;
    }

    public static readonly INSTANCE: VoidModel = new this();
}

type ExtractTypeInObjectValue<T> = {
    [K in keyof T]: T[K] extends TypeModel<infer U> ? U : never;
};

class ObjectModel<T> extends TypeModel<T> {
    private readonly object: T;

    protected constructor(object: T) {
        super();
        this.object = object;
    }

    public test(x: unknown): x is T {
        if (typeof x !== "object") return false;
        if (x === null) return false;

        for (const [key, type] of Object.entries(this.object as Record<string | number | symbol, TypeModel<unknown>>)) {
            const value: unknown = (x as Record<string | number | symbol, unknown>)[key];
            if (!type.test(value)) return false;
        }

        return true;
    }

    public exact(): ObjectModel<T> {
        const that = this;

        return new (class extends ObjectModel<T> {
            public test(x: unknown): x is T {
                if (that.test(x)) {
                    return Object.keys(x as object).length === Object.keys(this.object as object).length;
                }
                else return false;
            }
        })(this.object);
    }

    public static newInstance<U extends Record<string | number | symbol, TypeModel<unknown>>>(object: U): ObjectModel<ExtractTypeInObjectValue<U>> {
        return new this(object as ExtractTypeInObjectValue<U>);
    }
}

class ArrayModel<T> extends TypeModel<T[]> {
    private readonly type: TypeModel<T>;

    public constructor(type: TypeModel<T>) {
        super();
        this.type = type;
    }

    public test(x: unknown): x is T[] {
        return Array.isArray(x)
            && x.every(e => this.type.test(e));
    }

    public withLength(range: LengthRange): ArrayModel<T> {
        const min = range.min === undefined ? 0 : range.min;
        const max = range.max === undefined ? Infinity : range.max;

        if (min > max || min < 0) {
            throw TypeError("無効な範囲です");
        }

        const that = this;

        return new (class extends ArrayModel<T> {
            public test(x: unknown): x is T[] {
                return that.test(x) && (min <= x.length && x.length <= max);
            }
        })(this.type);
    }

    public getModelOfElement(): TypeModel<T> {
        return this.type;
    }
}

class FunctionModel extends TypeModel<Function> {
    private constructor() {
        super();
    }

    public test(x: unknown): x is Function {
        return typeof x === "function";
    }

    public static readonly INSTANCE: FunctionModel = new this();
}

class SymbolModel extends TypeModel<symbol> {
    private constructor() {
        super();
    }

    public test(x: unknown): x is symbol {
        return typeof x === "symbol";
    }

    public static readonly INSTANCE: SymbolModel = new this();
}

type ExtractTypes<U extends TypeModel<unknown>[]> = U[number] extends TypeModel<infer V> ? V : never;

class UnionModel<T> extends TypeModel<T> {
    private readonly types: TypeModel<T>[];

    private constructor(...types: TypeModel<unknown>[]) {
        super();
        this.types = types as TypeModel<T>[];
    }

    public override test(x: unknown): x is T {
        return this.types.some(type => type.test(x));
    }

    public static newInstance<U extends TypeModel<unknown>[]>(...types: U): UnionModel<ExtractTypes<U>> {
        return new this(...types);
    }
}

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type ExtractIntersectTypes<T extends TypeModel<unknown>[]> = UnionToIntersection<(T extends TypeModel<infer U>[] ? U[] : never)[number]>;

class IntersectionModel<T> extends TypeModel<T> {
    private readonly types: TypeModel<T>[];

    private constructor(...types: TypeModel<unknown>[]) {
        super();
        this.types = types as TypeModel<T>[];
    }

    public override test(x: unknown): x is T {
        return this.types.some(type => type.test(x));
    }

    public static newInstance<U extends TypeModel<unknown>[]>(...types: U): IntersectionModel<ExtractIntersectTypes<U>> {
        return new this(...types);
    }
}

class OptionalModel<T> extends TypeModel<T | undefined> {
    private readonly type: TypeModel<T>;

    private constructor(type: TypeModel<T>) {
        super();
        this.type = type;
    }

    public override test(x: unknown): x is (T | undefined) {
        return this.type.test(x)
            || sentry.undefined.test(x);
    }

    public unwrap(): TypeModel<T> {
        return this.type;
    }

    public static newInstance<U>(type: TypeModel<U>): OptionalModel<U> {
        return new this(type);
    }
}

class NullableModel<T> extends TypeModel<T | null> {
    private readonly type: TypeModel<T>;

    private constructor(type: TypeModel<T>) {
        super();
        this.type = type;
    }

    public override test(x: unknown): x is (T | null) {
        return this.type.test(x)
            || sentry.null.test(x);
    }

    public unwrap(): TypeModel<T> {
        return this.type;
    }

    public static newInstance<U>(type: TypeModel<U>): NullableModel<U> {
        return new this(type);
    }
}

class MapModel<K, V> extends TypeModel<Map<K, V>> {
    private readonly keyType: TypeModel<K>;

    private readonly valueType: TypeModel<V>;

    public constructor(keyType: TypeModel<K>, valueType: TypeModel<V>) {
        super();
        this.keyType = keyType;
        this.valueType = valueType;
    }

    public test(x: unknown): x is Map<K, V> {
        if (!(x instanceof Map)) return false;
        for (const [key, value] of x.entries()) {
            if (!this.keyType.test(key)) return false;
            if (!this.valueType.test(value)) return false;
        }

        return true;
    }

    public getModelOfKey(): TypeModel<K> {
        return this.keyType;
    }

    public getModelOfValue(): TypeModel<V> {
        return this.valueType;
    }
}

class SetModel<T> extends TypeModel<Set<T>> {
    private readonly valueType: TypeModel<T>;

    public constructor(valueType: TypeModel<T>) {
        super();
        this.valueType = valueType;
    }

    public test(x: unknown): x is Set<T> {
        if (!(x instanceof Set)) return false;
        for (const value of x.values()) {
            if (!this.valueType.test(value)) return false;
        }

        return true;
    }

    public getModelOfElement(): TypeModel<T> {
        return this.valueType;
    }
}

class ClassModel<T> extends TypeModel<T> {
    private constructor(private readonly constructorObject: Function) {
        super();
    }

    public test(x: unknown): x is T {
        return x instanceof this.constructorObject;
    }

    public static newInstance<U extends Function>(constructor: U): ClassModel<U["prototype"]> {
        return new this(constructor);
    }
}

type TypeModelArrayToTuple<T extends TypeModel<unknown>[]> = { [K in keyof T]: T[K] extends TypeModel<infer U> ? U : never }

class TupleModel<T extends TypeModel<unknown>[]> extends TypeModel<TypeModelArrayToTuple<T>> {
    private readonly tuple: T;

    private constructor(tuple: T) {
        super();
        this.tuple = tuple;
    }

    public override test(x: unknown): x is TypeModelArrayToTuple<T> {
        if (!Array.isArray(x)) return false;
        else if (x.length !== this.tuple.length) return false;
        
        for (const [index, model] of this.tuple.entries()) {
            if (!model.test(x[index])) return false;
        }

        return true;
    }

    public static newInstance<T extends TypeModel<unknown>[]>(...elements: T): TupleModel<T> {
        return new this(elements);
    }
}

class LiteralModel<T extends boolean | number | bigint | string | symbol> extends PrimitiveModel<T> {
    private readonly value: T;

    public constructor(value: T) {
        super();
        this.value = value;
    }

    public override test(x: unknown): x is T {
        return x === this.value;
    }

    public getLiteralValue(): T {
        return this.value;
    }

    public static newInstance<U extends boolean | number | bigint | string | symbol>(string: U): LiteralModel<U> {
        return new this(string);
    }
}

class TypeSentryError extends TypeError {
    public constructor(message: string) {
        super(message);
    }
}

const INTERNAL_CONSTRUCTOR_KEY = Symbol();

export class TypeSentry {
    protected constructor(key: typeof INTERNAL_CONSTRUCTOR_KEY) {}

    public readonly boolean: BooleanModel = BooleanModel.INSTANCE;

    public readonly number: NumberModel = NumberModel.INSTANCE;

    public readonly bigint: BigIntModel = BigIntModel.INSTANCE;

    public readonly string: StringModel = StringModel.INSTANCE;

    public readonly null: NullModel = NullModel.INSTANCE;

    public readonly undefined: UndefinedModel = UndefinedModel.INSTANCE;

    public readonly any: AnyModel = AnyModel.INSTANCE;

    public readonly never: NeverModel = NeverModel.INSTANCE;

    public readonly void: VoidModel = VoidModel.INSTANCE;

    public readonly function: FunctionModel = FunctionModel.INSTANCE;

    public readonly symbol: SymbolModel = SymbolModel.INSTANCE;

    public readonly int: IntModel = IntModel.INSTANCE;

    public objectOf<U extends Record<string | number | symbol, TypeModel<unknown>>>(object: U): ObjectModel<ExtractTypeInObjectValue<U>> {
        return ObjectModel.newInstance(object);
    }

    public arrayOf<U>(type: TypeModel<U>): ArrayModel<U> {
        return new ArrayModel(type);
    }

    public mapOf<K, V>(keyType: TypeModel<K>, valueType: TypeModel<V>): MapModel<K, V> {
        return new MapModel(keyType, valueType);
    }

    public setOf<T>(valueType: TypeModel<T>): SetModel<T> {
        return new SetModel(valueType);
    }

    public unionOf<U extends TypeModel<unknown>[]>(...types: U): UnionModel<ExtractTypes<U>> {
        return UnionModel.newInstance(...types);
    }

    public intersectionOf<U extends TypeModel<unknown>[]>(...types: U): IntersectionModel<ExtractIntersectTypes<U>> {
        return IntersectionModel.newInstance(...types);
    }

    public optionalOf<U>(type: TypeModel<U>): OptionalModel<U> {
        return OptionalModel.newInstance(type);
    }

    public nullableOf<U>(type: TypeModel<U>): NullableModel<U> {
        return NullableModel.newInstance(type);
    }

    public classOf<U extends Function>(constructor: U): ClassModel<U["prototype"]> {
        return ClassModel.newInstance(constructor);
    }

    public tupleOf<U extends TypeModel<unknown>[]>(...elements: U): TupleModel<U> {
        return TupleModel.newInstance(...elements);
    }

    public literalOf<U extends boolean | number | bigint | string | symbol>(literal: U) {
        return LiteralModel.newInstance(literal);
    }
}

export const sentry: TypeSentry = (class extends TypeSentry {
    public static readonly INSTANCE: TypeSentry = new this(INTERNAL_CONSTRUCTOR_KEY);
}).INSTANCE;
