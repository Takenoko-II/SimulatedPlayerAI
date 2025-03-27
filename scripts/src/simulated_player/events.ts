import { EntityDamageSource, Block, Entity, EntityDamageCause, Player } from "@minecraft/server";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";

export interface SimulatedPlayerEventHandlerRegistrar {
    /**
     * イベント登録用関数
     * @param event イベントの種類
     * @param listener イベントリスナー
     * @returns 登録解除用のid
     */
    on<T extends keyof SimulatedPlayerEventTypes>(event: T, listener: (event: SimulatedPlayerEventTypes[T]) => void): number;

    /**
     * イベント登録解除用関数
     * @param id events.on()が返す数値id
     */
    off(id: number): void;
}

interface SimulatedPlayerEvent {
    /**
     * このイベントを発火させたプレイヤー
     */
    readonly simulatedPlayerManager: SimulatedPlayerManager;
}

interface SimulatedPlayerHealthChangeEvent extends SimulatedPlayerEvent {
    readonly previousValue: number;

    readonly currentValue: number;
}

interface SimulatedPlayerDieEvent extends SimulatedPlayerEvent {
    readonly damageSource: EntityDamageSource;
}

interface SimulatedPlayerSpawnEvent extends SimulatedPlayerEvent {}

interface SimulatedPlayerHurtEvent extends SimulatedPlayerEvent {
    readonly damageAmount: number;

    readonly damageSource: EntityDamageSource;
}

interface SimulatedPlayerPlaceBlockEvent extends SimulatedPlayerEvent {
    readonly block: Block;
}

interface SimulatedPlayerAttackEntityEvent extends SimulatedPlayerEvent {
    readonly target: Entity;

    readonly damage: number;

    readonly cause: EntityDamageCause;
}

interface SimulatedPlayerInteractedByPlayerEvent extends SimulatedPlayerEvent {
    readonly interacter: Player;
}

type SimulatedPlayerEventTypes = {
    readonly onHealthChange: SimulatedPlayerHealthChangeEvent;

    readonly onDie: SimulatedPlayerDieEvent;

    readonly onSpawn: SimulatedPlayerSpawnEvent;

    readonly onHurt: SimulatedPlayerHurtEvent;

    readonly onPlaceBlock: SimulatedPlayerPlaceBlockEvent;

    readonly onAttack: SimulatedPlayerAttackEntityEvent;

    readonly onInteractedByPlayer: SimulatedPlayerInteractedByPlayerEvent;
}

type RegistryUnion<T extends keyof SimulatedPlayerEventTypes = keyof SimulatedPlayerEventTypes> = T extends unknown ? SimulatedPlayerEventHandlerRegistry<T> : never;

export class SimulatedPlayerEventHandlerRegistry<T extends keyof SimulatedPlayerEventTypes> {
    private readonly __name__: T;

    private readonly __handlers__: Map<number, (event: SimulatedPlayerEventTypes[T]) => void> = new Map();

    private constructor(event: T) {
        this.__name__ = event;
        SimulatedPlayerEventHandlerRegistry.__registries__.add(this as unknown as RegistryUnion);
    }

    public add(listener: (event: SimulatedPlayerEventTypes[T]) => void): number {
        const id = SimulatedPlayerEventHandlerRegistry.__eventHandlerMaxId__++;
        this.__handlers__.set(id, listener);
        return id;
    }

    public call(event: SimulatedPlayerEventTypes[T]): void {
        this.__handlers__.forEach(listener => {
            listener(event);
        });
    }

    private static __eventHandlerMaxId__: number = 0;

    private static readonly __registries__: Set<RegistryUnion> = new Set();

    public static get<T extends keyof SimulatedPlayerEventTypes>(event: T): SimulatedPlayerEventHandlerRegistry<T> {
        for (const registry of this.__registries__) {
            if (registry.__name__ === event) {
                return registry as unknown as SimulatedPlayerEventHandlerRegistry<T>;
            }
        }

        throw new TypeError("無効なイベント名です");
    }

    public static remove(id: number): void {
        for (const registry of this.__registries__) {
            if (registry.__handlers__.has(id)) {
                registry.__handlers__.delete(id);
                break;
            }
        }
    }

    public static readonly onHealthChange = new this("onHealthChange");

    public static readonly onDie = new this("onDie");

    public static readonly onSpawn = new this("onSpawn");

    public static readonly onHurt = new this("onHurt");

    public static readonly onPlaceBlock = new this("onPlaceBlock");

    public static readonly onAttack = new this("onAttack");

    public static readonly onInteractedByPlayer = new this("onInteractedByPlayer");
}
