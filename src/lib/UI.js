// @ts-ignore
/**
 * @author Takenoko-II
 * @copyright 2024/06/23
 */

import { Player, system } from "@minecraft/server";

import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

/**
 * @typedef {import("./UI").ServerFormCancelEvent} ServerFormCancelEvent
 * @typedef {import("./UI").ServerFormButtonPushEvent} ServerFormButtonPushEvent
 * @typedef {import("./UI").ModalFormSubmitEvent} ModalFormSubmitEvent
 * @typedef {import("./UI").Button} Button
 * @typedef {import("./UI").ModalFormElement} ModalFormElement
 * @typedef {import("./UI").ModalFormToggle} ModalFormToggle
 * @typedef {import("./UI").ModalFormSlider} ModalFormSlider
 * @typedef {import("./UI").ModalFormTextField} ModalFormTextField
 * @typedef {import("./UI").ModalFormDropdown} ModalFormDropdown
 */

/**
 * @param {unknown} value 
 * @returns {value is number}
 */
function isNumber(value) {
    return typeof value === "number" && !Number.isNaN(value);
}

/**
 * @param {unknown} value 
 * @returns {value is string[]}
 */
function isStringArray(value) {
    if (!Array.isArray(value)) return false;
    
    return !value.some(_ => typeof _ !== "string");
}

export class ServerFormElementPredicates {
    /**
     * @param {unknown} value
     * @returns {value is Button}
     */
    static isButton(value) {
        return typeof value["name"] === "string"
            && (typeof value.iconPath === "string" || value.iconPath === undefined)
            && typeof value.callbacks instanceof Set
            && isStringArray(value.tags)
    }

    /**
     * @param {unknown} value 
     * @returns {value is ModalFormElement}
     */
    static isModalFormElement(value) {
        return typeof value.id === "string"
            && typeof value.label === "string";
    }

    /**
     * @param {unknown} value 
     * @returns {value is ModalFormToggle}
     */
    static isToggle(value) {
        return this.isModalFormElement(value)
            && typeof value.defaultValue === "boolean";
    }

    /**
     * @param {unknown} value 
     * @returns {value is ModalFormSlider}
     */
    static isSlider(value) {
        return this.isModalFormElement(value)
            && isNumber(value.range?.min)
            && isNumber(value.range?.max)
            && isNumber(value.step)
            && isNumber(value.defaultValue);
    }

    /**
     * @param {unknown} value 
     * @returns {value is ModalFormTextField}
     */
    static isTextField(value) {
        return this.isModalFormElement(value)
            && typeof value.placeHolder === "string"
            && typeof value.defaultValue === "string";
    }

    /**
     * @param {unknown} value 
     * @returns {value is ModalFormDropdown}
     */
    static isDropdown(value) {
        return this.isModalFormElement(value)
            && isStringArray(value.list)
            && isNumber(value.defaultValueIndex);
    }
}

/**
 * @param {object} object
 * @param {...string} keys
 * @returns {object}
 */
function freezeKey(object, ...keys) {
    if (typeof object !== "object" || object === null || !Array.isArray(keys)) {
        throw new TypeError("第一引数がオブジェクトでないか、残余引数が配列ではありません");
    }
    else if (keys.length === 0 || keys.some(_ => typeof _ !== "string")) {
        throw new TypeError("残余引数の配列の長さが0か、string[]ではありません");
    }

    for (const key of keys) {
        Object.defineProperty(object, key, { configurable: false, writable: false });
    }

    return object;
}

class ServerFormWrapper {
    constructor(key) {
        if (key !== ServerFormWrapper.PRIVATE_KEY) {
            throw new Error("このクラスのコンストラクタを外部から呼び出すことは原則禁止されています");
        }
    }

    /**
     * @type {string}
     */
    titleText;

    /**
     * @readonly
     */
    cancelationCallbacks = {
        /**
         * @type {Set<(event: ServerFormCancelEvent) => void>}
         * @readonly
         */
        "UserBusy": new Set(),
        /**
         * @type {Set<(event: ServerFormCancelEvent) => void>}
         * @readonly
         */
        "UserClosed": new Set(),
        /**
         * @type {Set<(event: ServerFormCancelEvent) => void>}
         * @readonly
         */
        "Any": new Set()
    };

    title(text) {
        if (typeof text !== "string") {
            throw new TypeError("第一引数はstring型である必要があります");
        }

        this.titleText = text;

        return this;
    }

    onCancel(value, callbackFn) {
        if (typeof callbackFn !== "function") {
            throw new TypeError("第二引数は関数である必要があります");
        }

        switch (value) {
            case "Any": {
                this.cancelationCallbacks.Any.add(callbackFn);
                break;
            }
            case "UserBusy": {
                this.cancelationCallbacks.UserBusy.add(callbackFn);
                break;
            }
            case "UserClosed": {
                this.cancelationCallbacks.UserClosed.add(callbackFn);
                break;
            }
            default: throw new TypeError("第一引数は列挙型'ServerFormCancelationCause'の値である必要があります");
        }

        return this;
    }

    open(_) {
        throw new Error("ServerFormWrapperクラスから直接open関数を使用することはできません");
    }

    /**
     * @readonly
     */
    static PRIVATE_KEY = Symbol("ServerFormWrapper");
}

export class ActionFormWrapper extends ServerFormWrapper {
    constructor() {
        super(ServerFormWrapper.PRIVATE_KEY);
    }

    /**
     * @readonly
     * @private
     */
    #data = {
        body: "",

        /**
         * @type {Button[]}
         * @readonly
         */
        buttons: [],

        /**
         * @type {Map<(button: Button) => boolean, (event: ServerFormButtonPushEvent) => void>}
         * @readonly
         */
        pushEventCallbacks: new Map()
    };

    body(...text) {
        if (!Array.isArray(text)) {
            throw new TypeError("引数が配列ではありません");
        }
        else if (text.length === 0 || text.some(_ => typeof _ !== "string")) {
            throw new TypeError("引数の配列の長さが0か、配列がstring[]ではありません");
        }

        this.#data.body = text.join("\n");

        return this;
    }

    button(name, a, b, c) {
        if (typeof name !== "string") {
            throw new TypeError("第一引数はstringである必要があります");
        }

        /**
         * @type {Button}
         */
        const button = { name };

        Object.defineProperties(button, {
            tags: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: []
            },
            callbacks: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: new Set()
            }
        });

        this.#data.buttons.push(button);

        if (typeof a === "string" && b === undefined && c === undefined) {
            button.iconPath = a;
        }
        else if (typeof a === "function" && b === undefined && c === undefined) {
            button.callbacks.add(a);
        }
        else if (typeof a === "string" && typeof b === "function" && c === undefined) {
            button.iconPath = a;
            button.callbacks.add(b);
        }
        else if (isStringArray(a) && b === undefined && c === undefined) {
            button.tags.push(...a);
        }
        else if (typeof a === "string" && isStringArray(b) && c === undefined) {
            button.iconPath = a;
            button.tags.push(...b);
        }
        else if (typeof a === "function" && isStringArray(b) && c === undefined) {
            button.callbacks.add(a);
            button.tags.push(...b);
        }
        else if (typeof a === "string" && typeof b === "function" && isStringArray(c)) {
            button.iconPath = a;
            button.callbacks.add(b);
            button.tags.push(...c);
        }
        else if (!(a === undefined && b === undefined && c === undefined)) {
            console.warn(a, b, c);
            throw new TypeError("渡された引数の型が適切ではありません");
        }

        return this;
    }

    open(player) {
        if (!(player instanceof Player)) {
            throw new TypeError("プレイヤーじゃないやつにフォーム表示できるわけないやろ");
        }

        if (typeof this.titleText !== "string") {
            throw new TypeError("タイトル文字列として保存されている値がstringではありません: " + this.titleText);
        }

        const form = new ActionFormData()
        .title(this.titleText);

        if (this.#data.body !== undefined) {
            form.body(this.#data.body);
        }

        for (const button of this.#data.buttons) {
            form.button(button.name, button.iconPath);
        }

        form.show(player).then(response => {
            if (response.selection === undefined) {
                const that = this;
                const input = {
                    player,
                    reason: response.cancelationReason,
                    reopen() {
                        system.run(() => {
                            that.open(player);
                        });
                    }
                };

                this.cancelationCallbacks.Any.forEach(callbackFn => {
                    callbackFn(input);
                });

                if (response.cancelationReason === "UserBusy") {
                    this.cancelationCallbacks.UserBusy.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }
                else if (response.cancelationReason === "UserClosed") {
                    this.cancelationCallbacks.UserClosed.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }

                return;
            }

            const button = this.#data.buttons[response.selection];

            if (button.callbacks.size > 0) {
                button.callbacks.forEach(callbackFn => {
                    callbackFn(player);
                });
            }

            this.#data.pushEventCallbacks.forEach((callbackFn, predicate) => {
                if (predicate(button)) {
                    callbackFn({ player, button });
                }
            });
        });
    }

    onPush(predicate, callbackFn) {
        if (typeof predicate !== "function") {
            throw new TypeError("第一引数は関数である必要があります");
        }
        if (typeof callbackFn !== "function") {
            throw new TypeError("第二引数は関数である必要があります");
        }

        this.#data.pushEventCallbacks.set(predicate, callbackFn);

        return this;
    }

    /**
     * @readonly
     */
    get buttons() {
        const that = this;

        return {
            getByPredicate(predicate) {
                if (typeof predicate !== "function") {
                    throw new TypeError("引数は関数である必要があります");
                }

                return that.#data.buttons.filter(predicate);
            }
        };
    }

    set buttons(_) {
        throw new TypeError("プロパティ 'buttons' は読み取り専用です");
    }
}

export class ModalFormWrapper extends ServerFormWrapper {
    constructor() {
        super(ServerFormWrapper.PRIVATE_KEY);
    }

    /**
     * @private
     * @readonly
     */
    #data = {
        /**
         * @type {(ModalFormToggle | ModalFormSlider | ModalFormTextField | ModalFormDropdown)[]}
         * @readonly
         */
        values: [],

        /**
         * @type {Set<(event: ModalFormSubmitEvent) => void>}
         * @readonly
         */
        submitEventCallbacks: new Set(),

        /**
         * @type {string}
         */
        submitButtonName: undefined
    };

    toggle(id, label, defaultValue = false) {
        if (ServerFormElementPredicates.isToggle(id) && label === undefined && defaultValue === false) {
            const obj = Object.assign({ type: "toggle" }, id);
            this.#data.values.push(freezeKey(obj, "id", "type"));
            return this;
        }

        if (typeof id !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第一引数はstringである必要があります");
        }
        else if (typeof label !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第二引数はstringである必要があります");
        }
        else if (typeof defaultValue !== "boolean") {
            throw new TypeError("この形式の関数呼び出しでは第三引数はbooleanである必要があります");
        }

        const toggle = { id, type: "toggle", label, defaultValue };

        this.#data.values.push(toggle);

        return this;
    }

    slider(id, label, range, step = 1, defaultValue = 0) {
        if (ServerFormElementPredicates.isSlider(id) && label === undefined && range === undefined && step === 1 && defaultValue === 0) {
            const obj = Object.assign({ type: "slider" }, id);
            this.#data.values.push(freezeKey(obj, "id", "type", "range"));
            return this;
        }

        if (typeof id !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第一引数はstringである必要があります");
        }
        else if (typeof label !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第二引数はstringである必要があります");
        }
        else if (!(typeof range === "object" && range !== null)) {
            throw new TypeError("この形式の関数呼び出しでは第三引数はオブジェクトである必要があります");
        }
        else if (!(isNumber(range.min) && isNumber(range.max))) {
            throw new TypeError("この形式の関数呼び出しでは第三引数はNumberRangeである必要がありますが、キーが非NaNのnumber型ではないか、存在しない可能性があります");
        }
        else if (!isNumber(step)) {
            throw new TypeError("この形式の関数呼び出しでは第四引数はNaNでないnumberである必要があります");
        }
        else if (!isNumber(defaultValue)) {
            throw new TypeError("この形式の関数呼び出しでは第五引数はNaNでないnumberである必要があります");
        }

        const slider = { id, type: "slider", label, range, step, defaultValue };

        this.#data.values.push(slider);

        return this;
    }

    dropdown(id, label, list, defaultValueIndex = 0) {
        if (ServerFormElementPredicates.isDropdown(id) && label === undefined && list === undefined && defaultValueIndex === 0) {
            const obj = Object.assign({ type: "dropdown" }, id);
            this.#data.values.push(freezeKey(obj, "id", "list"));
            return this;
        }

        if (typeof id !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第一引数はstringである必要があります");
        }
        else if (typeof label !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第二引数はstringである必要があります");
        }
        else if (!Array.isArray(list)) {
            throw new TypeError("この形式の関数呼び出しでは第三引数は配列である必要があります");
        }
        else if (list.length === 0) {
            throw new TypeError("この形式の関数呼び出しでは第三引数の配列の長さは1以上である必要があります");
        }
        else if (list.some(_ => typeof _ !== "string")) {
            throw new TypeError("この形式の関数呼び出しでは第三引数はstring[]である必要があります");
        }
        else if (!isNumber(defaultValueIndex)) {
            throw new TypeError("この形式の関数呼び出しでは第四引数はNaNでないnumberである必要があります");
        }

        const dropdown = { id, type: "dropdown", label, list, defaultValueIndex };

        this.#data.values.push(dropdown);

        return this;
    }

    textField(id, label, placeHolder = "", defaultValue = "") {
        if (ServerFormElementPredicates.isTextField(id) && label === undefined && placeHolder === "" && defaultValue === "") {
            const obj = Object.assign({ type: "textField" }, id);
            this.#data.values.push(freezeKey(obj, "id"));
            return this;
        }

        if (typeof id !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第一引数はstringである必要があります");
        }
        else if (typeof label !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第二引数はstringである必要があります");
        }
        else if (typeof placeHolder !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第三引数はstringである必要があります");
        }
        else if (typeof defaultValue !== "string") {
            throw new TypeError("この形式の関数呼び出しでは第四引数はstringである必要があります");
        }

        const textField = { id, type: "textField", label, placeHolder, defaultValue };

        this.#data.values.push(textField);

        return this;
    }

    submitButtonName(name) {
        if (typeof name !== "string") {
            throw new TypeError("引数がstringではありません");
        }

        this.#data.submitButtonName = name;

        return this;
    }

    onSubmit(callbackFn) {
        if (typeof callbackFn !== "function") {
            throw new TypeError("引数は関数である必要があります");
        }

        this.#data.submitEventCallbacks.add(callbackFn);

        return this;
    }

    open(player) {
        if (!(player instanceof Player)) {
            throw new TypeError("引数はプレイヤーである必要があります");
        }

        if (typeof this.titleText !== "string") {
            throw new TypeError("タイトル文字列として保存されている値がstringではありません: " + this.titleText);
        }

        const form = new ModalFormData()
        .title(this.titleText);

        if (this.#data.submitButtonName) form.submitButton(this.#data.submitButtonName);

        for (const value of this.#data.values) {
            switch (value.type) {
                case "toggle": {
                    form.toggle(value.label, value.defaultValue);
                    break;
                }
                case "slider": {
                    form.slider(value.label, value.range.min, value.range.max, value.step, value.defaultValue);
                    break;
                }
                case "dropdown": {
                    form.dropdown(value.label, value.list, value.defaultValueIndex);
                    break;
                }
                case "textField": {
                    form.textField(value.label, value.placeHolder, value.defaultValue);
                    break;
                }
            }
        }

        form.show(player).then(response => {
            if (response.formValues === undefined) {
                const that = this;
                const input = {
                    player,
                    reason: response.cancelationReason,
                    reopen() {
                        system.run(() => {
                            that.open(player);
                        });
                    }
                };

                this.cancelationCallbacks.Any.forEach(callbackFn => {
                    callbackFn(input);
                });

                if (response.cancelationReason === "UserBusy") {
                    this.cancelationCallbacks.UserBusy.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }
                else if (response.cancelationReason === "UserClosed") {
                    this.cancelationCallbacks.UserClosed.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }

                return;
            }

            const that = this;

            /**
             * @param {string} id 
             * @returns {"toggle" | "slider" | "dropdown" | "textField" | undefined}
             */
            function type(id) {
                if (typeof id !== "string") {
                    throw new TypeError("引数はstringである必要があります");
                }

                const index = that.#data.values.findIndex(_ => _.id === id);
                if (index === -1) return undefined;

                return that.#data.values[index].type;
            }

            /**
             * @param {string} id 
             * @returns {string | number | boolean | undefined}
             */
            function value(id) {
                if (typeof id !== "string") {
                    throw new TypeError("引数はstringである必要があります");
                }

                const index = that.#data.values.findIndex(_ => _.id === id);
                if (index === -1) return undefined;

                const value = that.#data.values[index];

                return value.type === "dropdown" ? value.list[response.formValues[index]] : response.formValues[index];
            }

            const input = {
                getToggle(id) {
                    if (type(id) === "toggle") return value(id);
                },
                getSlider(id) {
                    if (type(id) === "slider") return value(id);
                },
                getDropdown(id) {
                    if (type(id) === "dropdown") return value(id);
                },
                getTextField(id) {
                    if (type(id) === "textField") return value(id);
                },
                getAll() {
                    return response.formValues.map((formValue, index) => {
                        const value = that.#data.values[index];
                        return value.type === "dropdown" ? value.list[formValue] : formValue;
                    });
                }
            };

            this.#data.submitEventCallbacks.forEach(callbackFn => {
                callbackFn({ player, ...input });
            });
        });
    }

    /**
     * @readonly
     */
    get elements() {
        const that = this;

        function getElement(id) {    
            if (typeof id !== "string") {
                throw new TypeError("引数はstringである必要があります");
            }
    
            return that.#data.values.find(_ => _.id === id);
        }

        return {
            getToggle(id) {
                const element = getElement(id);

                return element.type === "toggle" ? element : undefined;
            },
            getSlider(id) {
                const element = getElement(id);

                return element.type === "slider" ? element : undefined;
            },
            getTextField(id) {
                const element = getElement(id);

                return element.type === "textField" ? element : undefined;
            },
            getDropdown(id) {
                const element = getElement(id);

                return element.type === "dropdown" ? element : undefined;
            },
            getSubmitButtonName() {
                return that.#data.submitButtonName;
            },
            getByPredicate(predicate) {
                if (typeof predicate !== "function") {
                    throw new TypeError("引数は関数である必要があります");
                }

                return that.#data.values.filter(predicate);
            }
        };
    }

    set elements(_) {
        throw new TypeError("プロパティ 'elements' は読み取り専用です");
    }
}

export class MessageFormWrapper extends ServerFormWrapper {
    constructor() {
        super(ServerFormWrapper.PRIVATE_KEY);

        Object.defineProperties(this.#data.button1, {
            tags: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: []
            },
            callbacks: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: new Set()
            }
        });

        Object.defineProperties(this.#data.button2, {
            tags: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: []
            },
            callbacks: {
                writable: false,
                enumerable: true,
                configurable: false,
                value: new Set()
            }
        });
    }

    /**
     * @private
     * @readonly
     */
    #data = {
        body: "",

        /**
         * @readonly
         * @type {Button}
         */
        button1: {
            /**
             * @type {string}
             * @readonly
             */
            name: "",

            /**
             * @type {Set<(player: Player) => void>}
             * @readonly
             */
            callbacks: new Set()
        },

        /**
         * @type {Button}
         * @readonly
         */
        button2: {
            /**
             * @type {string}
             * @readonly
             */
            name: "",

            /**
             * @type {Set<(player: Player) => void>}
             * @readonly
             */
            callbacks: new Set()
        },

        /**
         * @type {Map<(button: Button) => boolean, (event: ServerFormButtonPushEvent) => void>}
         * @readonly
         */
        pushEventCallbacks: new Map()
    };

    body(...text) {
        if (!Array.isArray(text)) {
            throw new TypeError("引数が配列ではありません");
        }
        else if (text.some(_ => typeof _ !== "string")) {
            throw new TypeError("引数がstring[]ではありません");
        }

        this.#data.body = text.join("\n");

        return this;
    }

    button1(name, a, b) {
        if (typeof name !== "string") {
            throw new TypeError("第一引数はstringである必要があります");
        }

        this.#data.button1.name = name;

        if (typeof a === "function" && b === undefined) {
            this.#data.button1.callbacks.add(a);
        }
        else if (isStringArray(a) && b === undefined) {
            this.#data.button1.tags.push(...a);
        }
        else if (typeof a === "function" && isStringArray(b)) {
            this.#data.button1.callbacks.add(a);
            this.#data.button1.tags.push(...b);
        }
        else if (!(a === undefined && b === undefined)) throw new TypeError("渡された引数の型が適切ではありません");

        return this;
    }

    button2(name, a, b) {
        if (typeof name !== "string") {
            throw new TypeError("第一引数はstringである必要があります");
        }

        this.#data.button2.name = name;
        
        if (typeof a === "function" && b === undefined) {
            this.#data.button2.callbacks.add(a);
        }
        else if (isStringArray(a) && b === undefined) {
            this.#data.button2.tags.push(...a);
        }
        else if (typeof a === "function" && isStringArray(b)) {
            this.#data.button2.callbacks.add(a);
            this.#data.button2.tags.push(...b);
        }
        else if (!(a === undefined && b === undefined)) throw new TypeError("渡された引数の型が適切ではありません");

        return this;
    }

    open(player) {
        if (!(player instanceof Player)) {
            throw new TypeError("引数はプレイヤーである必要があります");
        }

        if (typeof this.titleText !== "string") {
            throw new TypeError("タイトル文字列として保存されている値がstringではありません: " + this.titleText);
        }

        const form = new MessageFormData()
        .title(this.titleText);

        if (this.#data.body !== undefined) {
            form.body(this.#data.body);
        }

        form.button1(this.#data.button1.name);
        form.button2(this.#data.button2.name);

        form.show(player).then(response => {
            if (response.selection === undefined) {
                const that = this;
                const input = {
                    player,
                    reason: response.cancelationReason,
                    reopen() {
                        system.run(() => {
                            that.open(player);
                        });
                    }
                };

                this.cancelationCallbacks.Any.forEach(callbackFn => {
                    callbackFn(input);
                });

                if (response.cancelationReason === "UserBusy") {
                    this.cancelationCallbacks.UserBusy.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }
                else if (response.cancelationReason === "UserClosed") {
                    this.cancelationCallbacks.UserClosed.forEach(callbackFn => {
                        callbackFn(input);
                    });
                }

                return;
            }

            if (response.selection === 0) {
                this.#data.button1.callbacks.forEach(callbackFn => {
                    callbackFn(player);
                });

                this.#data.pushEventCallbacks.forEach((callbackFn, predicate) => {
                    if (predicate(this.#data.button1)) {
                        callbackFn({ button: this.#data.button1, player });
                    }
                });
            }
            else {
                this.#data.button2.callbacks.forEach(callbackFn => {
                    callbackFn(player);
                });

                this.#data.pushEventCallbacks.forEach((callbackFn, predicate) => {
                    if (predicate(this.#data.button2)) {
                        callbackFn({ button: this.#data.button2, player });
                    }
                });
            }
        });
    }

    onPush(predicate, callbackFn) {
        if (typeof predicate !== "function") {
            throw new TypeError("第一引数は関数である必要があります");
        }
        else if (typeof callbackFn !== "function") {
            throw new TypeError("第二引数は関数である必要があります");
        }

        this.#data.pushEventCallbacks.set(predicate, callbackFn);

        return this;
    }

    /**
     * @readonly
     */
    get buttons() {
        const that = this;

        return {
            getByPredicate(predicate) {
                if (typeof predicate !== "function") {
                    throw new TypeError("引数は関数である必要があります");
                }

                return [that.#data.button1, that.#data.button2].find(predicate);
            }
        };
    }

    set buttons(_) {
        throw new TypeError("プロパティ 'buttons' は読み取り専用です");
    }
}

export const ServerFormCancelationCause = Object.defineProperties({}, {
    Any: {
        writable: false,
        configurable: false,
        enumerable: true,
        value:  "Any"
    },
    UserBusy: {
        writable: false,
        configurable: false,
        enumerable: true,
        value: "UserBusy"
    },
    UserClosed: {
        writable: false,
        configurable: false,
        enumerable: true,
        value: "UserClosed"
    }
});
