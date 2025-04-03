export class Serializer {
    private __indentationSpaceCount__: number = 4;

    private __linebreakable__: boolean = true;

    private readonly hiddenPrototypes: Set<object> = new Set();

    public get indentationSpaceCount(): number {
        return this.__indentationSpaceCount__;
    }

    public set indentationSpaceCount(value: number) {
        if (Number.isNaN(value) || value < 0 || value > 20) {
            throw new TypeError("Indentation space count must not be NaN, must be integer, and must be within range(0, 20)");
        }

        this.__indentationSpaceCount__ = value;
    }

    public get linebreakable(): boolean {
        return this.__linebreakable__;
    }

    public set linebreakable(value: boolean) {
        this.__linebreakable__ = value;
    }

    public hidePrototypeOf(clazz: Function) {
        if (clazz.prototype === undefined) {
            throw new TypeError("It does not have prototype");
        }

        if (!this.hiddenPrototypes.has(clazz.prototype)) {
            this.hiddenPrototypes.add(clazz.prototype);
        }
    }

    public unhidePrototypeOf(clazz: Function) {
        if (clazz.prototype === undefined) {
            throw new TypeError("It does not have prototype");
        }

        if (this.hiddenPrototypes.has(clazz.prototype)) {
            this.hiddenPrototypes.delete(clazz);
        }
    }

    public serialize(value: any): string {
        return this.any(value, 1);
    }

    protected getPropertiesOf(object: object): string[] {
        return Object.getOwnPropertyNames(object);
    }

    protected getPrototypeOf(object: object): object | null {
        const prototype: object = Object.getPrototypeOf(object);

        if (object === prototype) {
            throw new Error("Circular prototype reference detection");
        }

        if (this.hiddenPrototypes.has(prototype)) {
            return null;
        }
        else {
            return prototype;
        }
    }

    protected boolean(boolean: boolean): string {
        return String(boolean);
    }

    protected number(number: number): string {
        return String(number);
    }

    protected bigint(bigint: bigint): string {
        return String(bigint);
    }

    protected string(string: string): string {
        return Serializer.QUOTE + string + Serializer.QUOTE;
    }

    protected symbol(symbol: symbol): string {
        return (symbol.description === undefined || symbol.description.length === 0)
            ? Serializer.SYMBOL
                + Serializer.ARGUMENTS_BRACES[0]
                + Serializer.ARGUMENTS_BRACES[1]
            : Serializer.SYMBOL
                + Serializer.ARGUMENTS_BRACES[0]
                + this.string(symbol.description)
                + Serializer.ARGUMENTS_BRACES[1];
    }

    protected null(): string {
        return Serializer.NULL;
    }

    protected undefined(): string {
        return Serializer.UNDEFINED;
    }

    protected indentation(count: number): string {
        return Serializer.WHITESPACE.repeat(this.__indentationSpaceCount__).repeat(count);
    }

    protected linebreak(): string {
        return this.__linebreakable__ ? Serializer.LINEBREAK : Serializer.EMPTY;
    }

    protected prototype(object: object, indentation: number): string {
        const prototype: object | null = this.getPrototypeOf(object);

        let string = Serializer.EMPTY;

        if (prototype === null) {
            return string;
        }

        let forceAsObject: boolean = false;

        if (Array.isArray(object)) {
            forceAsObject = true;

            if (object.length > 0) {
                string += Serializer.COMMA;
            }
        }
        else if (this.getPropertiesOf(object).length > 0) {
            string += Serializer.COMMA;
        }

        string += this.linebreak()
            + this.indentation(indentation)
            + Serializer.PROTOTYPE
            + Serializer.COLON
            + Serializer.WHITESPACE
            + this.object(prototype, indentation + 1, forceAsObject);

        return string;
    }

    protected function(__function__: Function): string {
        const code: string = __function__.toString();

        if (code.startsWith(Serializer.FUNCTION + Serializer.WHITESPACE)) {
            return Serializer.FUNCTION
                + Serializer.WHITESPACE
                + __function__.name
                + Serializer.ARGUMENTS_BRACES[0]
                + Serializer.ARGUMENTS_BRACES[1]
                + Serializer.WHITESPACE
                + Serializer.CODE;
        }
        else if (code.startsWith(Serializer.ASYNC + Serializer.WHITESPACE)) {
            return Serializer.ASYNC
                + Serializer.WHITESPACE
                + Serializer.FUNCTION
                + Serializer.WHITESPACE
                + __function__.name
                + Serializer.ARGUMENTS_BRACES[0]
                + Serializer.ARGUMENTS_BRACES[1]
                + Serializer.WHITESPACE
                + Serializer.CODE;
        }
        else if (code.startsWith(Serializer.CLASS + Serializer.WHITESPACE)) {
            return Serializer.CLASS
                + Serializer.WHITESPACE
                + __function__.name
                + Serializer.WHITESPACE
                + Serializer.CODE;
        }
        else {
            return __function__.name
                + Serializer.ARGUMENTS_BRACES[0]
                + Serializer.ARGUMENTS_BRACES[1]
                + Serializer.WHITESPACE
                + Serializer.CODE;
        }
    }

    protected key(key: string): string {
        if (Serializer.UNQUOTED_KEY_PATTERN().test(key)) {
            return key;
        }
        else {
            return this.string(key);
        }
    }

    protected object(object: object, indentation: number, forceAsObject: boolean = false): string {
        if (Array.isArray(object) && !forceAsObject) {
            return this.array(object, indentation);
        }
        else if (object === null) {
            return this.null();
        }

        let str: string = Serializer.OBJECT_BRACES[0];

        const keys: string[] = this.getPropertiesOf(object);

        for (let i = 0; i < keys.length; i++) {
            const key: string = keys[i];

            const v = Reflect.get(object, key);

            if (object === v) {
                throw new Error("Circular object reference detection");
            }

            const value: string = this.any(v, indentation + 1);

            str += this.linebreak()
                + this.indentation(indentation)
                + this.key(key)
                + Serializer.COLON
                + Serializer.WHITESPACE
                + value;

            if (i < keys.length - 1) {
                str += Serializer.COMMA;
            }
        }

        const prototype = this.prototype(object, indentation);

        str += prototype;

        if (keys.length > 0 || prototype.length > 0) {
            str += this.linebreak()
                + this.indentation(indentation - 1);
        }

        str += Serializer.OBJECT_BRACES[1];

        return str;
    }

    protected array(array: any[], indentation: number): string {
        let str: string = Serializer.ARRAY_BRACES[0];

        for (let i = 0; i < array.length; i++) {
            const v = array[i];

            if (array === v) {
                throw new Error("Circular array reference detection");
            }

            const value: string = this.any(v, indentation + 1);

            str += this.linebreak()
                + this.indentation(indentation)
                + value;

            if (i < array.length - 1) {
                str += Serializer.COMMA;
            }
        }

        const prototype = this.prototype(array, indentation);

        str += prototype;

        if (array.length > 0 || prototype.length > 0) {
            str += this.linebreak()
                + this.indentation(indentation - 1);
        }

        str += Serializer.ARRAY_BRACES[1];

        return str;
    }

    protected map(map: Map<unknown, unknown>, indentation: number): string {
        const obj: object = {};

        map.forEach((v, k) => {
            if (map === v) {
                throw new Error("Circular map reference detection");
            }

            Reflect.set(obj, (typeof k === "string") ? k : this.any(k, indentation), v);
        });

        return Serializer.MAP
            + Serializer.CLASS_INSTANCE_BRACES[0]
            + this.object(obj, indentation)
            + Serializer.CLASS_INSTANCE_BRACES[1];
    }

    protected set(set: Set<unknown>, indentation: number): string {
        const arr: unknown[] = [];

        set.forEach(value => {
            if (set === value) {
                throw new Error("Circular set reference detection");
            }

            arr.push((typeof value === "string") ? value : this.any(value, indentation));
        });

        return Serializer.SET
            + Serializer.WHITESPACE
            + Serializer.CLASS_INSTANCE_BRACES[0]
            + this.array(arr, indentation)
            + Serializer.CLASS_INSTANCE_BRACES[1];
    }

    protected any(any: any, indentation: number): string {
        if (any === null) {
            return this.null();
        }
        else if (any instanceof Map) {
            return this.map(any, indentation);
        }
        else if (any instanceof Set) {
            return this.set(any, indentation);
        }

        switch (typeof any) {
            case "boolean":
                return this.boolean(any);
            case "number":
                return this.number(any);
            case "bigint":
                return this.bigint(any);
            case "string":
                return this.string(any);
            case "symbol":
                return this.symbol(any);
            case "undefined":
                return this.undefined();
            case "function":
                return this.function(any);
            case "object":
                return this.object(any, indentation);
            default:
                throw new Error("NEVER HAPPENS");
        }
    }

    private static readonly ARGUMENTS_BRACES: [string, string] = ["(", ")"];

    private static readonly OBJECT_BRACES: [string, string] = ["{", "}"];

    private static readonly ARRAY_BRACES: [string, string] = ["[", "]"];

    private static readonly CLASS_INSTANCE_BRACES: [string, string] = ["<", ">"];

    private static readonly COMMA: string = ",";

    private static readonly COLON: string = ":";

    private static readonly WHITESPACE: string = " ";

    private static readonly QUOTE: string = "\"";

    private static readonly LINEBREAK: string = "\n";

    private static readonly EMPTY: string = "";

    private static readonly CODE: string = "{...}";

    private static readonly UNQUOTED_KEY_PATTERN: () => RegExp = () => /^[0-9]|[1-9][0-9]*|#?[a-zA-Z][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*$/g;

    private static readonly FUNCTION: string = "function";

    private static readonly ASYNC: string = "async";

    private static readonly CLASS: string = "class";

    private static readonly SYMBOL: string = "symbol";

    private static readonly MAP: string = "Map";

    private static readonly SET: string = "Set";

    private static readonly NULL: string = "null";

    private static readonly UNDEFINED: string = "undefined";

    private static readonly PROTOTYPE: string = "[[Prototype]]";
}
