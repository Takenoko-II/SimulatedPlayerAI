interface ImmutableConfiguration {
    readonly IGNORED: readonly string[];

    readonly SIGNS: readonly [string, string];

    readonly NUMBER_CHARS: readonly string[];

    readonly NUMBER_PARSER: (input: string) => number;

    readonly DECIMAL_POINT: string;

    readonly COMMA: string;

    readonly PARENTHESIS: readonly [string, string];
}

/**
 * なにも変えないで！
 */
const immutableConfiguration: ImmutableConfiguration = {
    IGNORED: [' ', '\n'],
    SIGNS: ['+', '-'],
    NUMBER_CHARS: "0123456789".split(""),
    NUMBER_PARSER: (input: string) => {
        if (/^(?:[+-]?\d+(?:\.\d+)?(?:(?:[eE][+-]?\d+)|(?:\*10\^[+-]?\d+))?)|[+-]?Infinity|NaN$/g.test(input)) {
            return Number.parseFloat(input);
        }
        else {
            throw new CalcExpEvaluationError("数値の解析に失敗しました: '" + input + "'");
        }
    },
    DECIMAL_POINT: '.',
    COMMA: ',',
    PARENTHESIS: ['(', ')']
};

/**
 * {@link ImmutableCalcExpEvaluator.evaluate()}から投げられるエラーのクラス
 */
export class CalcExpEvaluationError extends Error {
    public constructor(message: string, cause?: unknown) {
        (cause === undefined) ? super(message) : super(message, { cause });
    }
}

/**
 * {@link ImmutableCalcExpEvaluator}の既存の定義を操作する際に使用する、定義カテゴリを表現するクラス
 */
export class CalcContextDeclarationCategory<T> {
    private constructor() {}

    /**
     * 定数
     */
    public static readonly CONSTANT: CalcContextDeclarationCategory<number> = new CalcContextDeclarationCategory();

    /**
     * 関数
     */
    public static readonly FUNCTION: CalcContextDeclarationCategory<(args: number[]) => number> = new CalcContextDeclarationCategory();

    /**
     * 2つの値について操作する演算子
     */
    public static readonly OPERATOR: CalcContextDeclarationCategory<(x: number, y: number) => number> = new CalcContextDeclarationCategory();

    /**
     * 1つの値について操作する演算子
     */
    public static readonly SELF_OPERATOR: CalcContextDeclarationCategory<(x: number) => number> = new CalcContextDeclarationCategory();
}

/**
 * {@link CalcExpEvaluator.declare()}で定義するものの種類を指定するためのクラス
 */
export class CalcContextDeclarationCreator<T, U> {
    /**
     * 定義カテゴリ
     */
    public readonly category: CalcContextDeclarationCategory<U>;

    private constructor(category: CalcContextDeclarationCategory<U>, modifier: (declarer: CalcContextDeclarationCreator<T, U>) => void) {
        this.category = category;
        modifier(this);
    }

    /**
     * {@link CalcExpEvaluator.declare()}の第三引数を型変換するための関数(外部からの呼び出し非推奨)
     * @param value 型変換する値
     */
    public constant(value: T): number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    /**
     * {@link CalcExpEvaluator.declare()}の第三引数を型変換するための関数(外部からの呼び出し非推奨)
     * @param value 型変換する値
     */
    public function(value: T): (args: number[]) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    /**
     * {@link CalcExpEvaluator.declare()}の第三引数を型変換するための関数(外部からの呼び出し非推奨)
     * @param value 型変換する値
     */
    public operator(value: T): (x: number, y: number) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    /**
     * {@link CalcExpEvaluator.declare()}の第三引数を型変換するための関数(外部からの呼び出し非推奨)
     * @param value 型変換する値
     */
    public selfOperator(value: T): (x: number) => number {
        throw new TypeError("このインスタンスからは呼び出せません");
    }

    /**
     * 定数
     */
    public static readonly CONSTANT: CalcContextDeclarationCreator<number, number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.CONSTANT,
        declarer => {
            declarer.constant = (value: number) => value;
        }
    );

    /**
     * 可変長引数の関数
     */
    public static readonly FUNCTION_VARIABLE_LENGTH_ARGS: CalcContextDeclarationCreator<(args: number[]) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (args: number[]) => number) => {
                return func;
            }
        }
    );

    /**
     * 引数を取らない関数
     */
    public static readonly FUNCTION_NO_ARGS: CalcContextDeclarationCreator<() => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: () => number) => (args) => {
                if (args.length !== 0) {
                    throw new TypeError("引数の数は0つが期待されています");
                }
                else {
                    return func();
                }
            }
        }
    );

    /**
     * 引数を一つ取る関数
     */
    public static readonly FUNCTION_1_ARG: CalcContextDeclarationCreator<(x: number) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (x: number) => number) => (args) => {
                if (args.length !== 1) {
                    throw new TypeError("引数の数は1つが期待されています");
                }
                else {
                    return func(args[0]);
                }
            }
        }
    );

    /**
     * 引数を二つ取る関数
     */
    public static readonly FUNCTION_2_ARGS: CalcContextDeclarationCreator<(x: number, y: number) => number, (args: number[]) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.FUNCTION,
        declarer => {
            declarer.function = (func: (x: number, y: number) => number) => (args) => {
                if (args.length !== 2) {
                    throw new TypeError("引数の数は2つが期待されています");
                }
                else {
                    return func(args[0], args[1]);
                }
            }
        }
    );

    /**
     * 優先度が三番目に高い(最も低い)演算子
     */
    public static readonly OPERATOR_POLYNOMIAL: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    /**
     * 優先度が二番目に高い演算子
     */
    public static readonly OPERATOR_MONOMIAL: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    /**
     * 優先度が一番目に高い(最も高い)演算子
     */
    public static readonly OPERATOR_FACTOR: CalcContextDeclarationCreator<(x: number, y: number) => number, (x: number, y: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.OPERATOR,
        declarer => {
            declarer.operator = (func: (x: number, y: number) => number) => func;
        }
    );

    /**
     * 優先度が{@link CalcContextDeclarationCreator.OPERATOR_FACTOR}と同じであるため仕様非推奨な、因数の直後に付く演算子
     * @deprecated
     */
    public static readonly SELF_OPERATOR_NUMBER_SUFFIX: CalcContextDeclarationCreator<(x: number) => number, (x: number) => number> = new CalcContextDeclarationCreator(
        CalcContextDeclarationCategory.SELF_OPERATOR,
        declarer => {
            declarer.selfOperator = (func: (x: number) => number) => func;
        }
    );
}

/**
 * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のクラス
 */
export class ImmutableCalcExpEvaluator {
    protected readonly MONOMIAL_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly POLYNOMIAL_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly FACTOR_OPERATORS: Map<string, (x: number, y: number) => number> = new Map();

    protected readonly NUMBER_SUFFIX_OPERATORS: Map<string, (x: number) => number> = new Map();

    protected readonly FUNCTIONS: Map<string, (args: number[]) => number> = new Map();

    protected readonly CONSTANTS: Map<string, number> = new Map();

    private expression: string = "";

    private location: number = 0;

    /**
     * 真の場合、計算結果が`NaN`になることを許容します    
     * デフォルトでは`false`です
     */
    public readonly allowNaN: boolean;

    protected constructor(allowNaN: boolean) {
        this.allowNaN = allowNaN;
    }

    private isOver(): boolean {
        return this.location >= this.expression.length
    }

    private next(): string;

    private next(next: string): string;

    private next(next: boolean): string;

    private next(next: string | boolean = true): string | boolean {
        if (typeof next === "boolean") {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("文字数を超えた位置へのアクセスが発生しました");
            }

            const current: string = this.expression.charAt(this.location++);
    
            if (immutableConfiguration.IGNORED.includes(current) && next) return this.next();
    
            return current;
        }
        else {
            if (this.isOver()) return false;

            this.ignore();

            const str: string = this.expression.substring(this.location);

            if (str.startsWith(next)) {
                this.location += next.length;
                this.ignore();
                return true;
            }

            return false;
        }
    }

    private back(): void {
        this.location--;
    }

    private ignore(): void {
        if (this.isOver()) return;

        const current: string = this.expression.charAt(this.location++);

        if (immutableConfiguration.IGNORED.includes(current)) {
            this.ignore();
        }
        else {
            this.back();
        }
    }

    private test(...nexts: string[]): boolean {
        const loc = this.location;

        for (const next of nexts) {
            if (!this.next(next)) {
                this.location = loc;
                return false;
            }
        }

        this.location = loc;
        return true;
    }

    private number(): number {
        let string: string = "";

        for (const signChar of immutableConfiguration.SIGNS) {
            if (this.next(signChar)) {
                string += signChar;
                break;
            }
        }

        if (this.isFunction()) {
            try {
                const returnValue = this.getFunction()(this.arguments());

                if (typeof returnValue !== "number") {
                    throw new CalcExpEvaluationError("関数の戻り値の型が無効です: " + typeof returnValue);
                }

                string += returnValue;
            }
            catch (e) {
                throw new CalcExpEvaluationError("関数の呼び出しで例外が発生しました", e);
            }
        }
        else if (this.isConst()) {
            const returnValue = this.getConst();

            if (typeof returnValue !== "number") {
                throw new CalcExpEvaluationError("定数から取り出された値の型が無効です: " + typeof returnValue);
            }

            string += returnValue;
        }
        else if (immutableConfiguration.SIGNS.some(sign => this.test(sign)) || this.test(immutableConfiguration.PARENTHESIS[0])) {
            const value: number = this.polynomial();

            if (string.length === 0) {
                string += value.toString();
            }
            else {
                const signChar: string = string.charAt(0);
                string = this.applySign(value, signChar).toString();
            }
        }
        else {
            let dotAlreadyAppended: boolean = false;
            while (!this.isOver()) {
                const current: string = this.next(false);

                if (immutableConfiguration.NUMBER_CHARS.includes(current)) {
                    string += current;
                }
                else if (current == immutableConfiguration.DECIMAL_POINT) {
                    if (dotAlreadyAppended) {
                        throw new CalcExpEvaluationError("無効な小数点を検知しました");
                    }

                    string += current;
                    dotAlreadyAppended = true;
                }
                else {
                    this.back();
                    break;
                }
            }
        }

        return immutableConfiguration.NUMBER_PARSER(string);
    }

    private applySign(value: number, sign: string): number {
        if (immutableConfiguration.SIGNS[0] === sign) {
            return value;
        }
        else if (immutableConfiguration.SIGNS[1] === sign) {
            return -value;
        }
        else {
            throw new CalcExpEvaluationError("'" + sign + "'は無効な符号です");
        }
    }

    private sortIteratorInLongestOrder(mapIterator: IterableIterator<string>): string[] {
        return [...mapIterator].sort((a, b) => b.length - a.length);
    }

    private monomial(): number {
        let value: number = this.factorOperator(this.factor());

        a: while (!this.isOver()) {
            for (const operatorName of this.sortIteratorInLongestOrder(this.MONOMIAL_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.MONOMIAL_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value, this.factorOperator(this.factor()));
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("単項間演算子が例外を投げました", e)
                    }
                    continue a;
                }
            }
            break;
        }

        return value;
    }

    private polynomial(): number {
        let value: number = this.monomial();

        a: while (!this.isOver()) {
            for (const operatorName of this.sortIteratorInLongestOrder(this.POLYNOMIAL_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.POLYNOMIAL_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value, this.monomial());
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("多項間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }
            break;
        }

        return value;
    }

    private factorOperator(num: number): number {
        let value: number = num;

        a: while (!this.isOver()) {
            for (const operatorName of this.sortIteratorInLongestOrder(this.NUMBER_SUFFIX_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.NUMBER_SUFFIX_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    try {
                        value = operator(value);
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("接尾辞演算子が例外を投げました", e)
                    }
                    continue a;
                }
            }

            for (const operatorName of this.sortIteratorInLongestOrder(this.FACTOR_OPERATORS.keys())) {
                if (this.next(operatorName)) {
                    const operator = this.FACTOR_OPERATORS.get(operatorName);

                    if (operator === undefined) {
                        throw new CalcExpEvaluationError("NEVER HAPPENS");
                    }

                    const obj: number = this.factor();

                    try {
                        value = operator(value, obj);
                    }
                    catch (e) {
                        throw new CalcExpEvaluationError("因数間演算子が例外を投げました", e);
                    }
                    continue a;
                }
            }

            break;
        }

        return value;
    }

    private factor(): number {
        const current: string = this.next();

        if (current == immutableConfiguration.PARENTHESIS[0]) {
            let value: number = this.polynomial();

            if (this.isOver()) {
                throw new CalcExpEvaluationError("括弧が閉じられていません");
            }

            const next: string = this.next();

            if (next == immutableConfiguration.PARENTHESIS[1]) {
                this.ignore();
                return value;
            }
            else {
                throw new CalcExpEvaluationError("括弧が閉じられていません: " + next);
            }
        }
        else {
            this.back();
            return this.number();
        }
    }

    private arguments(): number[] {
        const args: number[] = [];

        if (!this.next(immutableConfiguration.PARENTHESIS[0])) {
            throw new CalcExpEvaluationError("関数の呼び出しには括弧が必要です");
        }

        if (this.next(immutableConfiguration.PARENTHESIS[1])) {
            return args;
        }

        while (true) {
            if (this.isOver()) {
                throw new CalcExpEvaluationError("引数の探索中に文字列外に来ました");
            }

            let value: number = this.polynomial();
            const next: string = this.next();

            if (next == immutableConfiguration.COMMA) {
                args.push(value);
            }
            else if (next == immutableConfiguration.PARENTHESIS[1]) {
                args.push(value);
                this.ignore();
                return args;
            }
            else {
                throw new CalcExpEvaluationError("関数の引数の区切りが見つかりません: " + next);
            }
        }
    }

    private isConst(): boolean {
        for (const name of this.sortIteratorInLongestOrder(this.CONSTANTS.keys())) {
            if (this.test(name)) {
                return true;
            }
        }

        return false;
    }

    private getConst(): number {
        for (const name of this.sortIteratorInLongestOrder(this.CONSTANTS.keys())) {
            if (this.next(name)) {
                return this.CONSTANTS.get(name) as number;
            }
        }

        throw new CalcExpEvaluationError("定数を取得できませんでした");
    }

    private isFunction(): boolean {
        for (const name of this.sortIteratorInLongestOrder(this.FUNCTIONS.keys())) {
            if (this.test(name, immutableConfiguration.PARENTHESIS[0])) {
                return true;
            }
        }

        return false;
    }

    private getFunction(): (args: number[]) => number {
        for (const name of this.sortIteratorInLongestOrder(this.FUNCTIONS.keys())) {
            if (this.test(name, immutableConfiguration.PARENTHESIS[0])) {
                const value = this.FUNCTIONS.get(name);

                this.next(name);

                if (value === undefined) {
                    throw new CalcExpEvaluationError("関数名に紐づけられた値がundefinedでした");
                }
                else {
                    return value;
                }
            }
        }

        throw new CalcExpEvaluationError("関数を取得できませんでした");
    }

    private index(): number {
        if (this.location != 0) {
            throw new CalcExpEvaluationError("カーソル位置が0ではありませんでした インスタンス自身がevaluate()を呼び出した可能性があります");
        }

        if (this.isOver()) {
            throw new CalcExpEvaluationError("空文字は計算できません");
        }

        const value: number = this.polynomial();

        if (this.expression.substring(this.location).length !== 0) {
            throw new CalcExpEvaluationError("式の終了後に無効な文字を検出しました");
        }

        return value;
    }

    /**
     * 引数に渡された文字列を式として評価します
     * @param expression 式
     * @returns 計算結果
     * @throws 文字列の解析に失敗するか、{@link ImmutableCalcExpEvaluator#allowNaN}が`false`の状態で`NaN`が出力された際に{@link CalcExpEvaluationError}をthrowします
     */
    public evaluate(expression: string): number {
        this.expression = expression;

        try {
            const value: number = this.index();

            if (Number.isNaN(value) && !this.allowNaN) {
                throw new CalcExpEvaluationError("式からNaNが出力されました");
            }

            return value;
        }
        catch (e) {
            throw e;
        }
        finally {
            this.location = 0;
            this.expression = "";
        }
    }

    /**
     * 指定のカテゴリに特定の名前の定義が存在するかどうかを返します
     * @param name 定義名
     * @param category 定義カテゴリ
     * @returns 定義されていれば`true`、そうでなければ`false`
     */
    public isDeclared<T>(name: string, category: CalcContextDeclarationCategory<T>): boolean {
        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                return this.CONSTANTS.has(name);
            case CalcContextDeclarationCategory.FUNCTION:
                return this.FUNCTIONS.has(name);
            case CalcContextDeclarationCategory.OPERATOR:
                return this.POLYNOMIAL_OPERATORS.has(name)
                    || this.MONOMIAL_OPERATORS.has(name)
                    || this.FACTOR_OPERATORS.has(name);
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                return this.NUMBER_SUFFIX_OPERATORS.has(name);
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    /**
     * 指定のカテゴリに存在する定義名を全て取得します
     * @param category 定義カテゴリ
     * @returns 定義名の{@link Set}
     */
    public getContextOf<T>(category: CalcContextDeclarationCategory<T>): ReadonlySet<string> {
        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                return new Set(this.CONSTANTS.keys());
            case CalcContextDeclarationCategory.FUNCTION:
                return new Set(this.FUNCTIONS.keys());
            case CalcContextDeclarationCategory.OPERATOR: {
                const set: Set<string> = new Set();

                for (const polynomial of this.POLYNOMIAL_OPERATORS.keys()) {
                    set.add(polynomial);
                }

                for (const monomial of this.MONOMIAL_OPERATORS.keys()) {
                    set.add(monomial);
                }

                for (const factor of this.FACTOR_OPERATORS.keys()) {
                    set.add(factor);
                }

                return set;
            }
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                return new Set(this.NUMBER_SUFFIX_OPERATORS.keys());
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        };
    }

    /**
     * 指定の定義名に値を紐づけます
     * @param name 定義名
     * @param declarer 宣言するものの種類
     * @param value 定義名に紐づける値
     */
    protected declare<T, U>(name: string, declarer: CalcContextDeclarationCreator<T, U>, value: T): void {
        if (name.includes(immutableConfiguration.PARENTHESIS[0])
            || name.includes(immutableConfiguration.PARENTHESIS[1])
            || name.includes(immutableConfiguration.COMMA)
        ) {
            throw new TypeError(
                `定義名に無効な文字(${immutableConfiguration.PARENTHESIS[0]}, ${immutableConfiguration.PARENTHESIS[1]}, ${immutableConfiguration.COMMA})が含まれています`
            );
        }

        switch (declarer.category) {
            case CalcContextDeclarationCategory.CONSTANT:
                this.CONSTANTS.set(name, declarer.constant(value));
                break;
            case CalcContextDeclarationCategory.FUNCTION:
                this.FUNCTIONS.set(name, declarer.function(value));
                break;
            case CalcContextDeclarationCategory.OPERATOR: {
                switch (declarer) {
                    case CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL:
                        this.POLYNOMIAL_OPERATORS.set(name, declarer.operator(value));
                        break;
                    case CalcContextDeclarationCreator.OPERATOR_MONOMIAL:
                        this.MONOMIAL_OPERATORS.set(name, declarer.operator(value));
                        break;
                    case CalcContextDeclarationCreator.OPERATOR_FACTOR:
                        this.FACTOR_OPERATORS.set(name, declarer.operator(value));
                        break;
                    default:
                        throw new TypeError("無効なDeclarerインスタンスです");
                }
                break;
            }
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                this.NUMBER_SUFFIX_OPERATORS.set(name, declarer.selfOperator(value));
                break;
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    /**
     * 指定の定義名の定義を削除します
     * @param name 定義名
     * @param category 定義カテゴリ
     */
    protected undeclare<T>(name: string, category: CalcContextDeclarationCategory<T>): void {
        if (!this.isDeclared(name, category)) {
            throw new TypeError("定義が見つかりません");
        }

        switch (category) {
            case CalcContextDeclarationCategory.CONSTANT:
                this.CONSTANTS.delete(name);
                break;
            case CalcContextDeclarationCategory.FUNCTION:
                this.FUNCTIONS.delete(name);
                break;
            case CalcContextDeclarationCategory.OPERATOR:
                this.POLYNOMIAL_OPERATORS.delete(name);
                this.MONOMIAL_OPERATORS.delete(name);
                this.FACTOR_OPERATORS.delete(name);
                break;
            case CalcContextDeclarationCategory.SELF_OPERATOR:
                this.NUMBER_SUFFIX_OPERATORS.delete(name);
                break;
            default:
                throw new TypeError("無効なCategoryインスタンスです");
        }
    }

    protected copyContextTo(value: ImmutableCalcExpEvaluator): void {
        value.CONSTANTS.clear();
        value.FUNCTIONS.clear();
        value.POLYNOMIAL_OPERATORS.clear();
        value.MONOMIAL_OPERATORS.clear();
        value.FACTOR_OPERATORS.clear();
        value.NUMBER_SUFFIX_OPERATORS.clear();

        for (const constant of this.CONSTANTS) {
            value.declare(constant[0], CalcContextDeclarationCreator.CONSTANT, constant[1]);
        }

        for (const func of this.FUNCTIONS) {
            value.declare(func[0], CalcContextDeclarationCreator.FUNCTION_VARIABLE_LENGTH_ARGS, func[1]);
        }

        for (const operator of this.POLYNOMIAL_OPERATORS) {
            value.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, operator[1]);
        }

        for (const operator of this.MONOMIAL_OPERATORS) {
            value.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_MONOMIAL, operator[1]);
        }

        for (const operator of this.FACTOR_OPERATORS) {
            value.declare(operator[0], CalcContextDeclarationCreator.OPERATOR_FACTOR, operator[1]);
        }

        for (const operator of this.NUMBER_SUFFIX_OPERATORS) {
            value.declare(operator[0], CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, operator[1]);
        }
    }

    /**
     * 定義を全てコピーした新しいインスタンスを作成します
     * @returns このインスタンスの新しいクローン
     */
    public clone(): ImmutableCalcExpEvaluator {
        const clone = new ImmutableCalcExpEvaluator(this.allowNaN);
        this.copyContextTo(clone);
        return clone;
    }

    /**
     * 定義を外部から追加・変更・削除することができない{@link CalcExpEvaluator}のインスタンスを作成します
     * @param initializer 初期化子
     * @returns 新しい{@link ImmutableCalcExpEvaluator}のインスタンス
     */
    public static newImmutableEvaluator(initializer: (evaluator: CalcExpEvaluator) => void): ImmutableCalcExpEvaluator {
        const evaluator = new CalcExpEvaluator();
        initializer(evaluator);
        const immutable = new ImmutableCalcExpEvaluator(evaluator.allowNaN);
        evaluator.copyContextTo(immutable);
        return immutable;
    }
}

export class CalcExpEvaluator extends ImmutableCalcExpEvaluator {
    public override allowNaN: boolean = false;

    public constructor() {
        super(false);
    }

    public override declare<T, U>(name: string, declarer: CalcContextDeclarationCreator<T, U>, value: T): void {
        super.declare(name, declarer, value);
    }

    public override undeclare<T>(name: string, category: CalcContextDeclarationCategory<T>): void {
        super.undeclare(name, category);
    }

    public override clone(): CalcExpEvaluator {
        const clone = new CalcExpEvaluator();
        this.copyContextTo(clone);
        clone.allowNaN = this.allowNaN;
        return clone;
    }

    public static newDefaultEvaluator(): CalcExpEvaluator {
        const evaluator = new CalcExpEvaluator();

        // 四則演算 + 剰余 + 累乗 + 階乗
        evaluator.declare("+", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x + y);
        evaluator.declare("-", CalcContextDeclarationCreator.OPERATOR_POLYNOMIAL, (x, y) => x - y);
        evaluator.declare("*", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x * y);
        evaluator.declare("/", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x / y);
        evaluator.declare("%", CalcContextDeclarationCreator.OPERATOR_MONOMIAL, (x, y) => x % y);
        evaluator.declare("**", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => x ** y);

        /*evaluator.declare("!", CalcContextDeclarationCreator.SELF_OPERATOR_NUMBER_SUFFIX, x => {
            if (!Number.isInteger(x)) throw new TypeError("階乗演算子は実質的な整数の値にのみ使用できます");
            else if (x < 0) throw new TypeError("階乗演算子は負の値に使用できません");
            else if (x > 127) throw new TypeError("階乗演算子は127!を超えた値を計算できないよう制限されています");

            let result = 1;
            for (let i = 2; i <= x; i++) {
                result *= i;
            }

            return result;
        });*/

        // ビット演算
        evaluator.declare("&", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x & y;
        });
        evaluator.declare("|", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("|演算子は実質的な整数の値にのみ使用できます");
            return x | y;
        });
        evaluator.declare("^", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if (!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x ^ y;
        });
        evaluator.declare("<<", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x << y;
        });
        evaluator.declare(">>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x >> y;
        });
        evaluator.declare(">>>", CalcContextDeclarationCreator.OPERATOR_FACTOR, (x, y) => {
            if(!(Number.isInteger(x) && Number.isInteger(y))) throw new TypeError("&演算子は実質的な整数の値にのみ使用できます");
            return x >>> y;
        });

        // 定数
        evaluator.declare("NaN", CalcContextDeclarationCreator.CONSTANT, NaN);
        evaluator.declare("PI", CalcContextDeclarationCreator.CONSTANT, Math.PI);
        evaluator.declare("TAU", CalcContextDeclarationCreator.CONSTANT, 2 * Math.PI);
        evaluator.declare("E", CalcContextDeclarationCreator.CONSTANT, Math.E);
        evaluator.declare("Infinity", CalcContextDeclarationCreator.CONSTANT, Infinity);

        // 引数0の関数
        evaluator.declare("random", CalcContextDeclarationCreator.FUNCTION_NO_ARGS, Math.random);

        // 引数1の関数
        evaluator.declare("sqrt", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.sqrt);
        evaluator.declare("cbrt", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.cbrt);
        evaluator.declare("abs", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.abs);
        evaluator.declare("floor", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.floor);
        evaluator.declare("ceil", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.ceil);
        evaluator.declare("round", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.round);
        evaluator.declare("sin", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.sin);
        evaluator.declare("cos", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.cos);
        evaluator.declare("tan", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.tan);
        evaluator.declare("asin", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.asin);
        evaluator.declare("acos", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.acos);
        evaluator.declare("atan", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.atan);
        evaluator.declare("exp", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.exp);
        evaluator.declare("to_degrees", CalcContextDeclarationCreator.FUNCTION_1_ARG, radian => radian * 180 / Math.PI);
        evaluator.declare("to_radians", CalcContextDeclarationCreator.FUNCTION_1_ARG, degree => degree * Math.PI / 180);
        evaluator.declare("log10", CalcContextDeclarationCreator.FUNCTION_1_ARG, Math.log10);
        evaluator.declare("factorial", CalcContextDeclarationCreator.FUNCTION_1_ARG, value => {
            if (!Number.isInteger(value)) throw new TypeError("階乗は実質的な整数の値にのみ使用できます");
            else if (value < 0) throw new TypeError("階乗は負の値に使用できません");
            else if (value > 127) throw new TypeError("階乗は127!を超えた値を計算できないよう制限されています");

            let result = 1;
            for (let i = 2; i <= value; i++) {
                result *= i;
            }

            return result;
        });

        // 引数2の関数
        evaluator.declare("log", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.log);
        evaluator.declare("atan2", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.atan2);
        evaluator.declare("min", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.min);
        evaluator.declare("max", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.max);
        evaluator.declare("pow", CalcContextDeclarationCreator.FUNCTION_2_ARGS, Math.pow);

        return evaluator;
    }
}
