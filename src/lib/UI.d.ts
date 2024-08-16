/**
 * @author Takenoko-II
 * @copyright 2024/06/23
 */

import { NumberRange } from "@minecraft/common";

import { Player } from "@minecraft/server";

/**
 * フォームが閉じられる要因
 */
export enum ServerFormCancelationCause {
    /**
     * `UserBusy`, `UserClosed`のどちらも含む
     */
    Any = "Any",

    /**
     * プレイヤーがフォームを開くことができる状況下にないとき
     */
    UserBusy = "UserBusy",

    /**
     * プレイヤー自身がフォームを閉じたとき
     */
    UserClosed = "UserClosed"
}

export class ServerFormElementPredicates {
    /**
     * @param value
     * @returns `value`が`Button`であれば真
     */
    static isButton(value: unknown): value is Button;

    /**
     * @param value
     * @returns `value`が`ModalFormElement`であれば真
     */
    static isModalFormElement(value: unknown): value is ModalFormElement;

    /**
     * @param value
     * @returns `value`が`ModalFormToggle`であれば真
     */
    static isToggle(value: unknown): value is ModalFormToggle;

    /**
     * @param value
     * @returns `value`が`ModalFormSlider`であれば真
     */
    static isSlider(value: unknown): value is ModalFormSlider;

    /**
     * @param value
     * @returns `value`が`ModalFormTextField`であれば真
     */
    static isTextField(value: unknown): value is ModalFormTextField;

    /**
     * @param value
     * @returns `value`が`ModalFormDropdown`であれば真
     */
    static isDropdown(value: unknown): value is ModalFormDropdown;
}

/**
 * フォームを作成するためのクラスが継承するクラス
 */
export class ServerFormWrapper<T extends ServerFormWrapper<T>> {
    /**
     * フォームのタイトルを変更します。
     * @param text タイトル
     * @returns `this`
     */
    title(text: string): T;

    /**
     * フォームが閉じられた際に呼び出されるコールバック関数を登録します。
     * @param value 閉じた要因
     * @param callbackFn コールバック関数
     * @returns `this`
     */
    onCancel(value: "Any" | "UserBusy" | "UserClosed", callbackFn: (event: ServerFormCancelEvent) => void): T;

    /**
     * フォームを表示します。
     * @param player プレイヤー
     */
    open(player: Player): void;
}

/**
 * ボタンが操作の主軸となるフォームのクラスが実装するインターフェース
 */
interface Pushable {
    /**
     * ボタンを押した際に発火するイベントのコールバックを登録します。
     * @param predicate ボタンの条件
     * @param callbackFn コールバック関数
     * @returns `this`
     */
    onPush(predicate: (button: Button) => boolean, callbackFn: (player: ServerFormButtonPushEvent) => void): Pushable;
}

/**
 * 送信ボタンのあるフォームのクラスが実装するインターフェース
 */
interface Submittable {
    /**
     * 送信ボタンの名前を設定します。
     * @param name ボタンの名前
     */
    submitButtonName(name: string): Submittable;

    /**
     * フォームの入力が送信された際に発火するイベントのコールバックを登録します。
     * @param callbackFn コールバック関数
     */
    onSubmit(callbackFn: (arg: ModalFormSubmitEvent) => void): Submittable;
}

/**
 * フォームが閉じられたときに発火するイベントのコールバックに渡される引数
 */
interface ServerFormCancelEvent {
    /**
     * プレイヤー
     */
    readonly player: Player;

    /**
     * 閉じた理由
     */
    readonly reason: ServerFormCancelationCause;

    /**
     * このフォームを再度開く
     */
    reopen(): void;
}

/**
 * フォームのボタンが押されたときに発火するイベントのコールバックに渡される引数
 */
interface ServerFormButtonPushEvent {
    /**
     * プレイヤー
     */
    readonly player: Player;

    /**
     * ボタンの名前
     */
    readonly button: Button;
}

/**
 * フォームが送信されたときに発火するイベントのコールバックに渡される引数
 */
interface ModalFormSubmitEvent {
    /**
     * プレイヤー
     */
    readonly player: Player;

    /**
     * 特定のIDのトグルを取得します。
     * @param id 要素のID
     */
    getToggle(id: string): boolean | undefined;

    /**
     * 特定のIDのスライダーを取得します。
     * @param id 要素のID
     */
    getSlider(id: string): number | undefined;

    /**
     * 特定のIDのドロップダウンを取得します。
     * @param id 要素のID
     */
    getDropdown(id: string): string | undefined;

    /**
     * 特定のIDのテキストフィールドを取得します。
     * @param id 要素のID
     */
    getTextField(id: string): string | undefined;

    /**
     * 入力された値を順にすべて返します。
     */
    getAll(): (string | number | boolean)[];
}

/**
 * ボタンを表現する型
 */
interface Button {
    /**
     * ボタンのID
     */
    name: string;

    /**
     * ボタンのアイコンのテクスチャパス
     */
    iconPath?: string;

    /**
     * ボタンを押したときに呼び出されるコールバック関数
     */
    readonly callbacks: Set<(player: Player) => void>
    
    /**
     * ボタンのタグ
     */
    readonly tags: string[];
}

/**
 * ModalFormの要素を表現する型
 */
interface ModalFormElement {
    /**
     * 要素のID
     */
    readonly id: string;

    /**
     * ラベル
     */
    label: string;
}

/**
 * トグルを表現する型
 */
interface ModalFormToggle extends ModalFormElement {
    /**
     * デフォルト値
     */
    defaultValue: boolean;
}

/**
 * スライダーを表現する型
 */
interface ModalFormSlider extends ModalFormElement {
    /**
     * スライダーの数値の間隔
     */
    step: number;

    /**
     * スライダーの数値の範囲
     */
    readonly range: NumberRange;

    /**
     * デフォルト値
     */
    defaultValue: number;
}

/**
 * テキストフィールドを表現する型
 */
interface ModalFormTextField extends ModalFormElement {    
    /**
     * テキストフィールドの入力欄が未入力状態のときに表示する文字列
     */
    placeHolder: string;

    /**
     * デフォルト値
     */
    defaultValue: string;
}

/**
 * ドロップダウンを表現する型
 */
interface ModalFormDropdown extends ModalFormElement {
    /**
     * ドロップダウンのリスト
     */
    readonly list: string[];

    /**
     * デフォルト値のインデックス
     */
    defaultValueIndex: number;
}

/**
 * ボタンの定義情報
 */
interface ActionFormButtonDefinitions {
    /**
     * 条件に一致するボタンを取得します。
     * @param predicate ボタンの条件
     */
    getByPredicate(predicate: (button: Button) => boolean): Button[] | undefined;
}

/**
 * ModalFormの要素の定義情報
 */
interface ModalFormElementDefinitions {
    /**
     * 特定のIDのトグルを取得します。
     * @param id 要素のID
     */
    getToggle(id: string): ModalFormToggle | undefined;

    /**
     * 特定のIDのスライダーを取得します。
     * @param id 要素のID
     */
    getSlider(id: string): ModalFormSlider | undefined;

    /**
     * 特定のIDのドロップダウンを取得します。
     * @param id 要素のID
     */
    getDropdown(id: string): ModalFormDropdown | undefined;

    /**
     * 特定のIDのテキストフィールドを取得します。
     * @param id 要素のID
     */
    getTextField(id: string): ModalFormTextField | undefined;

    /**
     * 送信ボタンの名前を取得します。
     */
    getSubmitButtonName(): string | undefined;

    /**
     * 条件に一致する要素を取得します。
     * @param predicate 要素の条件
     */
    getByPredicate<T extends ModalFormElement>(predicate: (element: ModalFormElement) => element is T): T[] | undefined;
}

/**
 * ボタンの定義情報
 */
interface MessageFormButtonDefinitions {
    /**
     * 条件に一致するボタンを取得します。
     * @param predicate ボタンの条件
     */
    getByPredicate(predicate: (button: Button) => boolean): Button | undefined;
}

/**
 * `ActionFormData`をより直感的かつ簡潔に扱うことを目的としたクラス
 */
export class ActionFormWrapper extends ServerFormWrapper<ActionFormWrapper> implements Pushable {
    /**
     * フォームの本文を変更します。
     * @param texts 本文
     */
    body(...texts: string[]): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     */
    button(name: string): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param iconPath ボタンのアイコンのテクスチャパス
     * @overload
     */
    button(name: string, iconPath: string): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @overload
     */
    button(name: string, callbackFn: (player: Player) => void): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param iconPath ボタンのアイコンのテクスチャパス
     * @param callbackFn コールバック関数
     * @overload
     */
    button(name: string, iconPath: string, callbackFn: (player: Player) => void): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param tags ボタンのタグ
     * @overload
     */
    button(name: string, tags: string[]): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param iconPath ボタンのアイコンのテクスチャパス
     * @param tags ボタンのタグ
     * @overload
     */
    button(name: string, iconPath: string, tags: string[]): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @param tags ボタンのタグ
     * @overload
     */
    button(name: string, callbackFn: (player: Player) => void, tags: string[]): ActionFormWrapper;

    /**
     * フォームにボタンを追加します。
     * @param name ボタンの名前
     * @param iconPath ボタンのアイコンのテクスチャパス
     * @param callbackFn コールバック関数
     * @param tags ボタンのタグ
     * @overload
     */
    button(name: string, iconPath: string, callbackFn: (player: Player) => void, tags: string[]): ActionFormWrapper;

    /**
     * ボタンを押した際に発火するイベントのコールバックを登録します。
     * @param predicate ボタンの条件
     * @param callbackFn コールバック関数
     */
    onPush(predicate: (button: Button) => void, callbackFn: (player: ServerFormButtonPushEvent) => void): ActionFormWrapper;

    /**
     * フォームのボタンの定義情報
     */
    readonly buttons: ActionFormButtonDefinitions;
}

/**
 * `ModalFormData`をより直感的かつ簡潔に扱うことを目的としたクラス
 */
export class ModalFormWrapper extends ServerFormWrapper<ModalFormWrapper> implements Submittable {
    /**
     * フォームにトグルを追加します。
     * @param id ID
     * @param label トグルのラベル
     * @param defaultValue デフォルト値
     */
    toggle(id: string, label: string, defaultValue?: boolean): ModalFormWrapper;

    /**
     * フォームにトグルを追加します。
     * @param toggle トグル
     * @overload
     */
    toggle(toggle: ModalFormToggle): ModalFormWrapper;

    /**
     * フォームにスライダーを追加します。
     * @param id ID
     * @param label スライダーのラベル
     * @param range スライダーの範囲
     * @param step スライダーの間隔
     * @param defaultValue デフォルト値
     */
    slider(id: string, label: string, range: NumberRange, step?: number, defaultValue?: number): ModalFormWrapper;

    /**
     * フォームにスライダーを追加します。
     * @param slider スライダー
     * @overload
     */
    slider(slider: ModalFormSlider): ModalFormWrapper;

    /**
     * フォームにドロップダウンを追加します。
     * @param id ID
     * @param label ドロップダウンのラベル
     * @param list ドロップダウンのリスト
     * @param defaultValueIndex デフォルトのインデックス
     */
    dropdown(id: string, label: string, list: string[], defaultValueIndex?: number): ModalFormWrapper;

    /**
     * フォームにドロップダウンを追加します。
     * @param dropdown ドロップダウン
     * @overload
     */
    dropdown(dropdown: ModalFormDropdown): ModalFormWrapper;

    /**
     * フォームにテキストフィールドを追加します。
     * @param id ID
     * @param label テキストフィールドのラベル
     * @param placeHolder テキストフィールドのプレイスホルダー
     * @param defaultValue デフォルト値
     */
    textField(id: string, label: string, placeHolder: string, defaultValue?: string): ModalFormWrapper;

    /**
     * フォームにテキストフィールドを追加します。
     * @param textField テキストフィールド
     * @overload
     */
    textField(textField: ModalFormTextField): ModalFormWrapper;

    /**
     * 送信ボタンの名前を設定します。
     * @param name ボタンの名前
     */
    submitButtonName(name: string): ModalFormWrapper;

    /**
     * フォームの入力が送信された際に発火するイベントのコールバックを登録します。
     * @param callbackFn コールバック関数
     */
    onSubmit(callbackFn: (arg: ModalFormSubmitEvent) => void): ModalFormWrapper;

    /**
     * フォームの要素の定義情報
     */
    readonly elements: ModalFormElementDefinitions;
}

/**
 * `MessageFormData`をより直感的かつ簡潔に扱うことを目的としたクラス
 */
export class MessageFormWrapper extends ServerFormWrapper<MessageFormWrapper> implements Pushable {
    /**
     * フォームの本文を変更します。
     * @param texts 本文
     */
    body(...texts: string[]): MessageFormWrapper;

    /**
     * フォームにボタン1を追加します。
     * @param name ボタンの名前
     */
    button1(name: string): MessageFormWrapper;

    /**
     * フォームにボタン1を追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @overload
     */
    button1(name: string, callbackFn: (player: Player) => void): MessageFormWrapper;

    /**
     * フォームにボタン1を追加します。
     * @param name ボタンの名前
     * @param tags ボタンのタグ
     * @overload
     */
    button1(name: string, tags: string[]): MessageFormWrapper;

    /**
     * フォームにボタン1を追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @param tags ボタンのタグ
     * @overload
     */
    button1(name: string, callbackFn: (player: Player) => void, tags: string[]): MessageFormWrapper;

    /**
     * フォームにボタン2を追加します。
     * @param name ボタンの名前
     */
    button2(name: string): MessageFormWrapper;

    /**
     * フォームにボタン2を追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @overload
     */
    button2(name: string, callbackFn: (player: Player) => void): MessageFormWrapper;

    /**
     * フォームにボタン2を追加します。
     * @param name ボタンの名前
     * @param tags ボタンのタグ
     * @overload
     */
    button2(name: string, tags: string[]): MessageFormWrapper;

    /**
     * フォームにボタン2を追加します。
     * @param name ボタンの名前
     * @param callbackFn コールバック関数
     * @param tags ボタンのタグ
     * @overload
     */
    button2(name: string, callbackFn: (player: Player) => void, tags: string[]): MessageFormWrapper;

    /**
     * ボタンを押した際に発火するイベントのコールバックを登録します。
     * @param predicate ボタンの条件
     * @param callbackFn コールバック関数
     */
    onPush(predicate: (button: Button) => boolean, callbackFn: (player: ServerFormButtonPushEvent) => void): MessageFormWrapper;

    /**
     * フォームのボタンの定義情報
     */
    readonly buttons: MessageFormButtonDefinitions;
}
