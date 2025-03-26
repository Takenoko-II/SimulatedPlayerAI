import { Block, Entity, EntityComponentTypes, EntityDamageCause, EntityDamageSource, EntityQueryOptions, EquipmentSlot, GameMode, ItemStack, LocationOutOfWorldBoundariesError, Player, System, system, UnloadedChunksError, Vector3, world } from "@minecraft/server";

import { register, SimulatedPlayer } from "@minecraft/server-gametest";

import { MinecraftDimensionTypes } from "./lib/@minecraft/vanilla-data/lib/index";

import { ActionFormWrapper, MessageFormWrapper, ModalFormWrapper } from "./lib/UI-2.0";
import { Vector3Builder } from "./util/Vector";
import { Material } from "./lib/Material";
import { RandomHandler } from "./util/Random";

/**
 * プレイヤー召喚リクエスト
 */
export interface SimulatedPlayerSpawnRequest {
    /**
     * プレイヤー名
     */
    readonly name: string;

    /**
     * スポーンさせる位置(リスポーンポイントじゃないよ！)
     */
    readonly spawnPoint?: Vector3;

    /**
     * ゲームモード(サバイバル推奨)
     */
    readonly gameMode?: GameMode;

    /**
     * プレイヤーが作成された瞬間実行される関数
     * @param manager 作成されたプレイヤーを表現するSimulatedPlayerManagerクラスのインスタンス
     * @param timeTakenToSpawn リクエスト送信から作成までにかかった時間
     */
    onCreate?(manager: SimulatedPlayerManager, timeTakenToSpawn: number): void;
}

interface SimulatedPlayerSpawnRequestInternalInfo extends SimulatedPlayerSpawnRequest {
    readonly time: number;

    newManager(player: SimulatedPlayer): SimulatedPlayerManager;
}

const nextSpawnRequestQueue: SimulatedPlayerSpawnRequestInternalInfo[] = [];

let ok: boolean = true;

register("simulated_player", "spawn", test => {
    if (nextSpawnRequestQueue.length === 0) {
        throw new Error();
    }

    const request = nextSpawnRequestQueue.shift()!;

    const player = test.spawnSimulatedPlayer(
        { x: 0, y: 0, z: 0 },
        request.name,
        request.gameMode ?? GameMode.survival
    );

    player.teleport(request.spawnPoint ?? Vector3Builder.from(world.getDefaultSpawnLocation()).add({ x: 0.5, y: 0.5, z: 0.5 }));
    player.addTag(SimulatedPlayerManager.PUBLIC_COMMAND_TAG);

    if (typeof request.onCreate === "function") {
        request.onCreate(request.newManager(player), Date.now() - request.time);
        ok = true;
    }
})
.structureName("simulated_player:")
.maxTicks(2147483647);

interface SimulatedPlayerEventHandlerRegistrar {
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

interface SimulatedPlayerCommonConfig {
    /**
     * プレイヤーが設置したブロックが壊れるまでの秒数
     */
    blockLifespanSeconds: number;

    /**
     * プレイヤーの球形索敵範囲の半径
     */
    followRange: number;

    /**
     * プレイヤーが設置するブロックの種類
     */
    blockMaterial: Material;
}

export enum SimulatedPlayerArmorMaterial {
    NONE = "none",
    LEATHER = "leather",
    GOLDEN = "golden",
    CHAINMAIL = "chainmail",
    IRON = "iron",
    DIAMOND = "diamond",
    NETHERITE = "netherite"
}

export enum SimulatedPlayerWeaponMaterial {
    NONE = "none",
    WOODEN = "wooden",
    GOLDEN = "golden",
    STONE = "stone",
    IRON = "iron",
    DIAMOND = "diamond",
    NETHERITE = "netherite"
}

export enum SimulatedPlayerAuxiliary {
    NONE = "none",
    SHIELD = "shield",
    TOTEM = "totem_of_undying"
}

export enum SimulatedPlayerAI {
    NONE = "none",
    COMBAT = "combat"
}

/**
 * SimulatedPlayer操作のメインクラス
 */
export class SimulatedPlayerManager {
    private readonly player: SimulatedPlayer;

    private __armor__: SimulatedPlayerArmorMaterial = SimulatedPlayerArmorMaterial.NONE;

    private __weapon__: SimulatedPlayerWeaponMaterial = SimulatedPlayerWeaponMaterial.NONE;

    private __auxiliary__: SimulatedPlayerAuxiliary = SimulatedPlayerAuxiliary.NONE;

    private __projectile__: ItemStack = new ItemStack(Material.SNOWBALL.getAsItemType());

    private __canUseEnderPearl__: boolean = true;

    private __ai__: SimulatedPlayerAI = SimulatedPlayerAI.NONE;

    /**
     * AIの種類
     */
    public get ai(): SimulatedPlayerAI {
        return this.__ai__;
    }

    public set ai(value) {
        this.__ai__ = value;
    }

    private constructor(player: SimulatedPlayer) {
        this.player = player;
        simulatedPlayerManagers.add(this);
    }

    /**
     * このインスタンスが表現するプレイヤーをSimulatedPlayerとして取得する関数
     */
    public getAsGameTestPlayer(): SimulatedPlayer {
        return this.player;
    }

    /**
     * このインスタンスが表現するプレイヤーをPlayerとして取得する関数
     */
    public getAsServerPlayer(): Player {
        return world.getPlayers().filter(player => player.id === this.player.id)[0];
    }

    /**
     * プレイヤーの防具
     */
    public get armor(): SimulatedPlayerArmorMaterial {
        return this.__armor__;
    }

    public set armor(value) {
        this.__armor__ = value;
        const equippable = this.getAsServerPlayer().getComponent(EntityComponentTypes.Equippable)!;
        if (this.__armor__ === "none") {
            equippable.setEquipment(EquipmentSlot.Head);
            // @ts-ignore
            equippable.setEquipment("Chest");
            equippable.setEquipment(EquipmentSlot.Legs);
            equippable.setEquipment(EquipmentSlot.Feet);
        }
        else {
            equippable.setEquipment(EquipmentSlot.Head, new ItemStack(this.__armor__ + "_helmet"));
            // @ts-ignore
            equippable.setEquipment("Chest", new ItemStack(this.__armor__ + "_chestplate"));
            equippable.setEquipment(EquipmentSlot.Legs, new ItemStack(this.__armor__ + "_leggings"));
            equippable.setEquipment(EquipmentSlot.Feet, new ItemStack(this.__armor__ + "_boots"));
        }
    }

    /**
     * プレイヤーの武器
     */
    public get weapon(): SimulatedPlayerWeaponMaterial {
        return this.__weapon__;
    }

    public set weapon(value) {
        this.__weapon__ = value;
        if (this.__weapon__ === "none") {
            this.getAsServerPlayer().getComponent(EntityComponentTypes.Inventory)!.container.setItem(0);
            this.getAsServerPlayer().selectedSlotIndex = 0;
        }
        else {
            this.getAsServerPlayer().getComponent(EntityComponentTypes.Inventory)!.container.setItem(0, new ItemStack(this.__weapon__ + "_sword"));
            this.getAsServerPlayer().selectedSlotIndex = 0;
        }
    }

    /**
     * オフハンドのアイテム
     */
    public get auxiliary(): SimulatedPlayerAuxiliary {
        return this.__auxiliary__;
    }

    public set auxiliary(value) {
        this.__auxiliary__ = value;

        const offHandEquipment = this.getAsServerPlayer().getComponent(EntityComponentTypes.Equippable)!.getEquipmentSlot(EquipmentSlot.Offhand);

        if (this.__auxiliary__ === "none") {
            offHandEquipment.setItem();
        }
        else {
            offHandEquipment.setItem(new ItemStack(this.__auxiliary__));
        }
    }

    /**
     * プレイヤーが使う中距離武器
     */
    public get projectile(): ItemStack {
        return this.__projectile__;
    }

    public set projectile(value) {
        this.__projectile__ = value;
    }

    /**
     * これがtrueだとプレイヤーはエンダーパールを使う
     */
    public get canUseEnderPearl(): boolean {
        return this.__canUseEnderPearl__;
    }

    public set canUseEnderPearl(value) {
        this.__canUseEnderPearl__ = value;
    }

    /**
     * Player#isValid() && SimulatedPlayer#isValid()を返す関数
     */
    public isValid(): boolean {
        return this.player.isValid && this.getAsServerPlayer().isValid;
    }

    public equip(): void {
        this.armor = this.armor;
        this.weapon = this.weapon;
        this.auxiliary = this.auxiliary;
    }

    private __reloading__: boolean = false;

    /**
     * もやんがちゃんとしてくれればこんなのいらないのにね！！！！！！！！！！！！
     */
    public async reload(): Promise<void> {
        if (this.__reloading__) throw new Error("still reloading");

        const location = this.getAsServerPlayer().location;
        this.getAsServerPlayer().teleport({ x: 100000, y: 0, z: 0 });
        this.__reloading__ = true;
        return new Promise(resolve => {
            system.runTimeout(() => {
                if (!this.isValid()) return;
                this.getAsServerPlayer().teleport(location);
                this.__reloading__ = false;
                resolve();
            }, 1);
        });
    }

    public openConfig(player: Player) {
        form.config(this).open(player);
    }

    /**
     * プレイヤーをワールドに召喚するよう要求する関数
     */
    public static requestSpawnPlayer(request: SimulatedPlayerSpawnRequest): void {
        this.waitToBeAddedToQueue({
            time: Date.now(),
            newManager(player) {
                return new SimulatedPlayerManager(player);
            },
            ...request
        });
    }

    private static waitToBeAddedToQueue(request: SimulatedPlayerSpawnRequestInternalInfo) {
        if (ok) {
            nextSpawnRequestQueue.push(request);
            ok = false;
            world.getDimension(MinecraftDimensionTypes.Overworld).runCommand("execute positioned 0.0 0.0 100000.0 run gametest run simulated_player:spawn");
        }
        else {
            system.run(() => {
                this.waitToBeAddedToQueue(request);
            });
        }
    }

    /**
     * 条件に一致するSimulatedPlayerManagerをすべて取得する
     * @param options EntityQueryOptionsが使えるよ
     */
    public static getManagers(options?: EntityQueryOptions): Set<SimulatedPlayerManager> {
        const set: Set<SimulatedPlayerManager> = new Set();

        for (const playerManager of simulatedPlayerManagers) {
            if (playerManager.isValid()) {
                if (options === undefined) {
                    set.add(playerManager);
                }
                else if (playerManager.getAsServerPlayer().matches(options)) {
                    set.add(playerManager);
                }
            }
        }

        return set;
    }

    /**
     * Entity#idからこのクラスのインスタンスを取得する関数
     * @param id Entity#idで取れる文字列
     * @returns 見つからなければundefined
     */
    public static getById(id: string): SimulatedPlayerManager | undefined {
        for (const playerManager of simulatedPlayerManagers) {
            if (playerManager.player.id === id) {
                return playerManager;
            }
        }

        return undefined;
    }

    /**
     * SimulatedPlayerに関するイベントを登録したり登録解除できたりするやつ
     */
    public static readonly events: SimulatedPlayerEventHandlerRegistrar = {
        on(event, listener) {
            return SimulatedPlayerEventHandlerRegistry.get(event).add(listener);
        },

        off(id) {
            SimulatedPlayerEventHandlerRegistry.remove(id);
        }
    };

    public static readonly PUBLIC_COMMAND_TAG: string = "simulated_player:identifier";

    /**
     * すべてのSimulatedPlayerに共通する設定を扱う
     */
    public static readonly commonConfig: SimulatedPlayerCommonConfig = {
        
        get blockLifespanSeconds(): number {
            return internalCommonConfig.blockLifespanSeconds;
        },

        set blockLifespanSeconds(value) {
            if (typeof value === "number" && !Number.isNaN(value) && Number.isInteger(value)) {
                internalCommonConfig.blockLifespanSeconds = value;
            }
            else throw new TypeError();
        },

        get followRange(): number {
            return internalCommonConfig.followRange;
        },

        set followRange(value) {
            if (typeof value === "number" && !Number.isNaN(value) && Number.isInteger(value)) {
                internalCommonConfig.followRange = value;
            }
            else throw new TypeError();
        },

        get blockMaterial(): Material {
            return internalCommonConfig.blockMaterial;
        },

        set blockMaterial(value) {
            if (!value.isBlock) {
                throw new TypeError();
            }

            internalCommonConfig.blockMaterial = value;
        }
    };

    /**
     * このクラスをフォームとしてプレイヤーに表示する関数
     * @param player フォームを表示すす対象
     */
    public static showAsForm(player: Player) {
        form.main().open(player);
    }
}

const internalCommonConfig: SimulatedPlayerCommonConfig = {
    blockLifespanSeconds: 3,
    followRange: 30,
    blockMaterial: Material.COBBLESTONE
}

const form = {
    main(): ActionFormWrapper {
        return new ActionFormWrapper()
        .title("Simulated Player Manager")
        .button({
            name: "§a召喚",
            iconPath: "textures/ui/color_plus",
            on(player) {
                form.spawn().open(player);
            }
        })
        .button({
            name: "§9コンフィグ",
            iconPath: "textures/ui/settings_glyph_color_2x",
            on(player) {
                form.list(manager => {
                    form.config(manager).open(player);
                }).open(player);
            }
        })
        .button({
            name: "§3再読み込み",
            iconPath: "textures/items/ender_pearl",
            on(player) {
                form.list(manager => {
                    form.reload(manager);
                    form.main().open(player);
                }).open(player);
            }
        })
        .button({
            name: "§c削除",
            iconPath: "textures/ui/trash_default",
            on(player) {
                form.list(manager => {
                    form.delete(manager).open(player);
                }).open(player);
            }
        })
        .button({
            name: "§4全プレイヤーを削除",
            iconPath: "textures/ui/realms_red_x",
            on(player) {
                form.deleteAll().open(player);
            }
        })
    },

    spawn(): ModalFormWrapper {
        return new ModalFormWrapper()
        .title("Spawn Simulated Player")
        .textField({
            id: "name",
            label: "プレイヤー名",
            placeHolder: "おなまえ",
            defaultValue: "Steve"
        })
        .submitButton({
            name: "召喚する",
            on(event) {
                SimulatedPlayerManager.requestSpawnPlayer({
                    name: event.getTextFieldInput("name")!,
                    onCreate(player, time) {
                        player.ai = SimulatedPlayerAI.COMBAT;
                        console.warn(player.getAsServerPlayer().name + " joined. (" + time + "ms)");
                    }
                });
            }
        });
    },

    delete(manager: SimulatedPlayerManager): MessageFormWrapper {
        return new MessageFormWrapper()
        .title("Delete Simulated Player")
        .body(manager.getAsGameTestPlayer().name + "を削除しますか？")
        .button1({
            name: "y",
            on(player) {
                form.main().open(player);
            }
        })
        .button2({
            name: "n",
            on(player) {
                manager.getAsGameTestPlayer().disconnect();
            }
        });
    },

    deleteAll(): MessageFormWrapper {
        return new MessageFormWrapper()
        .title("Delete All Simulated Player")
        .body("全プレイヤーを削除しますか？")
        .button1({
            name: "y",
            on(player) {
                form.main().open(player);
            }
        })
        .button2({
            name: "n",
            on(player) {
                SimulatedPlayerManager.getManagers().forEach(manager => manager.getAsGameTestPlayer().disconnect());
            }
        });
    },

    list(callback: (manager: SimulatedPlayerManager) => void): ActionFormWrapper {
        const list = new ActionFormWrapper()
            .title("List of Simulated Player");

        for (const player of SimulatedPlayerManager.getManagers()) {
            list.button({
                name: "§6" + player.getAsGameTestPlayer().name,
                tags: ["player", player.getAsGameTestPlayer().id]
            })
        }

        list.button({
            name: "Back",
            iconPath: "textures/ui/back_button_default",
            on(player) {
                form.main().open(player);
            }
        })
        .onPush(button => button.tags.includes("player"), event => {
            const manager = SimulatedPlayerManager.getById(event.button.tags[1]);
            if (manager === undefined) return;
            callback(manager);
        });
        return list;
    },

    config(manager: SimulatedPlayerManager): ModalFormWrapper {
        const armorMaterials = Object.values(SimulatedPlayerArmorMaterial);
        const weaponMaterials = Object.values(SimulatedPlayerWeaponMaterial);
        const auxiliaries = Object.values(SimulatedPlayerAuxiliary);
        const aiTypes = Object.values(SimulatedPlayerAI);
        return new ModalFormWrapper()
        .title("Simulated Player Config")
        .dropdown({
            id: "armor",
            label: "防具",
            list: armorMaterials.map(v => ({ id: v, text: v })),
            defaultValueIndex: armorMaterials.indexOf(manager.armor)
        })
        .dropdown({
            id: "weapon",
            label: "近接武器",
            list: weaponMaterials.map(v => ({ id: v, text: v })),
            defaultValueIndex: weaponMaterials.indexOf(manager.weapon)
        })
        .dropdown({
            id: "auxiliary",
            label: "オフハンド",
            list: auxiliaries.map(v => ({ id: v, text: v })),
            defaultValueIndex: auxiliaries.indexOf(manager.auxiliary)
        })
        .dropdown({
            id: "ai",
            label: "AI",
            list: aiTypes.map(v => ({ id: v, text: v })),
            defaultValueIndex: aiTypes.indexOf(manager.ai)
        })
        .submitButton({
            name: { translate: "gui.submit" },
            on(event) {
                manager.ai = aiTypes.find(ai => ai === event.getDropdownInput("ai")?.value.id)!;
                manager.armor = armorMaterials.find(armor => armor === event.getDropdownInput("armor")?.value.id)!;
                manager.weapon = weaponMaterials.find(weapon => weapon === event.getDropdownInput("weapon")?.value.id)!;
                manager.auxiliary = auxiliaries.find(auxiliary => auxiliary === event.getDropdownInput("auxiliary")?.value.id)!;
            }
        });
    },

    reload(manager: SimulatedPlayerManager) {
        manager.reload().then(() => {
            console.warn("reload: " + manager.getAsGameTestPlayer().name);
        });
    }
};

const simulatedPlayerManagers: Set<SimulatedPlayerManager> = new Set();

export class SimulatedPlayerEventHandlerRegistry<T extends keyof SimulatedPlayerEventTypes> {
    private readonly __name__: T;

    private readonly __handlers__: Map<number, (event: SimulatedPlayerEventTypes[T]) => void> = new Map();

    private constructor(event: T) {
        this.__name__ = event;
        SimulatedPlayerEventHandlerRegistry.__registries__.add(this);
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

    private static readonly __registries__: Set<SimulatedPlayerEventHandlerRegistry<keyof SimulatedPlayerEventTypes>> = new Set();

    public static get<T extends keyof SimulatedPlayerEventTypes>(event: T): SimulatedPlayerEventHandlerRegistry<T> {
        for (const registry of this.__registries__) {
            if (registry.__name__ === event) return registry as SimulatedPlayerEventHandlerRegistry<T>;
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

world.afterEvents.entityHealthChanged.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.entity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

    const maxHealth = manager.getAsServerPlayer().getComponent(EntityComponentTypes.Health)!.effectiveMax;

    const value = Math.floor(clamp(event.newValue, 0, maxHealth) * 10) / 10;

    manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f${value}`;

    SimulatedPlayerEventHandlerRegistry.get("onHealthChange").call({
        "currentValue": event.newValue,
        "previousValue": event.oldValue,
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.entityDie.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.deadEntity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    SimulatedPlayerEventHandlerRegistry.get("onDie")!.call({
        "damageSource": event.damageSource,
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.playerSpawn.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.player.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    manager.getAsGameTestPlayer().teleport(Vector3Builder.from(world.getDefaultSpawnLocation()).add({ x: 0.5, y: 0, z: 0.5 }));
    manager.getAsServerPlayer().selectedSlotIndex = 0;

    system.runTimeout(() => {
        manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f20`;
    });

    SimulatedPlayerEventHandlerRegistry.get("onSpawn").call({
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.playerLeave.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.playerId);

    if (manager === undefined) return;

    simulatedPlayerManagers.delete(manager);

    world.sendMessage([
        { text: "§e" },
        {
            translate: "multiplayer.player.left",
            with: [event.playerName]
        }
    ]);
});

world.afterEvents.entityHurt.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.hurtEntity.id);

    if (manager === undefined) return;

    SimulatedPlayerEventHandlerRegistry.get("onHurt").call({
        "simulatedPlayerManager": manager,
        "damageAmount": event.damage,
        "damageSource": event.damageSource
    });
});

world.afterEvents.entityHurt.subscribe(event => {
    const damager = event.damageSource.damagingEntity;

    if (damager === undefined) return;

    const manager = SimulatedPlayerManager.getById(damager.id);

    if (manager === undefined) return;

    SimulatedPlayerEventHandlerRegistry.get("onAttack").call({
        "simulatedPlayerManager": manager,
        "target": event.hurtEntity,
        "damage": event.damage,
        "cause": event.damageSource.cause
    });
});

world.beforeEvents.playerInteractWithEntity.subscribe(async event => {
    const manager = SimulatedPlayerManager.getById(event.target.id);

    if (manager === undefined) return;

    await Promise.resolve();

    SimulatedPlayerEventHandlerRegistry.get("onInteractedByPlayer").call({
        "simulatedPlayerManager": manager,
        "interacter": event.player
    });
});

const handledMap: Map<SimulatedPlayerManager, boolean> = new Map();
const simulatedPlayerFallingTicks: Map<SimulatedPlayerManager, number> = new Map();

const leftOrRight: Map<SimulatedPlayerManager, "L" | "R"> = new Map();

const excludeTypes = [
    "fishing_hook",
    "arrow",
    "thrown_trident",
    "snowball",
    "egg",
    "ender_pearl",
    "area_effect_cloud",
    "item",
    "xp_orb",
    "xp_bottle",
    "splash_potion",
    "lingering_potion",
    "fireball",
    "small_fireball",
    "minecart",
    "chest_minecart",
    "hopper_minecart",
    "tnt_minecart",
    "command_block_minecart",
    "boat",
    "chest_boat",
    "dragon_fireball",
    "wither_skull",
    "wither_skull_dangerous",
    "falling_block",
    "tnt",
    "ender_crystal",
    "evocation_fang",
    "lightning_bolt",
    "fireworks_rocket",
    "painting",
    "shulker_bullet",
    "npc",
    "leash_knot",
    "llama_spit",
    "eye_of_ender_signal",
    "armor_stand",
    "wind_charge_projectile"
];

function placeBlockAndJump(manager: SimulatedPlayerManager) {
    const player = manager.getAsGameTestPlayer();
    const location = manager.getAsServerPlayer().location;
    const block = manager.getAsServerPlayer().dimension.getBlock(location)!;

    player.jump();

    system.runTimeout(() => {
        if (!manager.isValid()) return;

        player.stopMoving();
        player.isSprinting = false;
        putTemporaryBlock(manager, block);
    }, 6);
}

function placeBlockAsPath(manager: SimulatedPlayerManager) {
    const player = manager.getAsGameTestPlayer();
    const location = manager.getAsServerPlayer().location;
    const block = manager.getAsServerPlayer().dimension.getBlock(location)?.below();

    if (block === undefined) return;

    if (!block.isSolid && !block.below()?.isSolid && player.isOnGround) {
        putTemporaryBlock(manager, block);
    }
}

function putTemporaryBlock(manager: SimulatedPlayerManager, block: Block) {
    if (!block.isAir && !block.isLiquid) return;

    manager.getAsGameTestPlayer().attack();

    block.setType(internalCommonConfig.blockMaterial.getAsBlockType());

    const temporaryBlocks: TemporaryBlock[] = JSON.parse((world.getDynamicProperty("simulated_player:temporary_blocks") ?? "[]") as string);

    temporaryBlocks.push({
        dimensionId: block.dimension.id,
        location: block.location,
        seconds: internalCommonConfig.blockLifespanSeconds
    });

    world.setDynamicProperty("simulated_player:temporary_blocks", JSON.stringify(temporaryBlocks));

    SimulatedPlayerEventHandlerRegistry.get("onPlaceBlock").call({
        "simulatedPlayerManager": manager,
        "block": block
    });
}

interface TemporaryBlock {
    readonly location: Vector3;

    readonly dimensionId: string;

    seconds: number;
}

const baseStrength = 0.65;

system.runInterval(() => {
    for (const playerManager of SimulatedPlayerManager.getManagers()) {
        if (playerManager.getAsGameTestPlayer().isFalling) {
            const ticks = simulatedPlayerFallingTicks.get(playerManager);
            if (ticks === undefined) {
                simulatedPlayerFallingTicks.set(playerManager, 1);
            }
            else {
                simulatedPlayerFallingTicks.set(playerManager, ticks + 1);
            }
        }
        else {
            simulatedPlayerFallingTicks.set(playerManager, 0);
        }

        if (playerManager.ai === SimulatedPlayerAI.NONE) {
            if (system.currentTick % 30 === 0) {
                playerManager.getAsGameTestPlayer().stopMoving();
                playerManager.getAsGameTestPlayer().isSprinting = false;
            }
            continue;
        }

        const location = playerManager.getAsServerPlayer().location;

        const player = playerManager.getAsGameTestPlayer();

        const serverPlayer = playerManager.getAsServerPlayer();

        const entities = player.dimension.getEntities({ location: location, maxDistance: internalCommonConfig.followRange, excludeTypes })
        .filter(entity => {
            if (entity.id === player.id) return false;

            if (entity instanceof Player) {
                return entity.getGameMode() !== GameMode.creative;
            }

            return true;
        });

        const target = entities[0];

        const distance = target ? Vector3Builder.from(location).getDistanceTo(target.location) : 0;

        if (player.isSneaking && !(handledMap.get(playerManager) ?? false)) {
            handledMap.set(playerManager, true);
            system.runTimeout(() => {
                if (!player.isValid) return;
                player.jump();
                player.isSneaking = false;
                handledMap.set(playerManager, false);
            }, 10);
        }

        if (entities.length > 0 && distance < 5) {
            const direction = Vector3Builder.from(location).getDirectionTo(target.location);
            const dist = Vector3Builder.from(location).getDistanceTo(target.location);
            const rayCastResultFeet = serverPlayer.dimension.getBlockFromRay(location, direction, { maxDistance: dist + 1 });
            const rayCastResultEyes = serverPlayer.dimension.getBlockFromRay(serverPlayer.getHeadLocation(), direction, { maxDistance: dist + 1 });

            if ((simulatedPlayerFallingTicks.get(playerManager) ?? 0) > 1 && (rayCastResultEyes === undefined || rayCastResultFeet === undefined)) {
                serverPlayer.selectedSlotIndex = 0;
                const r = player.attackEntity(target);
                if (r) {
                    leftOrRight.set(playerManager, RandomHandler.choice(["L", "R"]));
                }
            }
        }

        const dir = Vector3Builder.from(player.getViewDirection());
        dir.y = 0;
        dir.scale(0.75);

        const forward = Vector3Builder.from(player.location)
        .add(dir);

        const dim = playerManager.getAsServerPlayer().dimension;

        const blocks = [
            dim.getBlock(forward),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(0.75))),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(-0.75)))
        ]
        .filter(b => b !== undefined);

        if (entities.length > 0 && system.currentTick % 5 === 0 && blocks.some(block => block.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            if (blocks.every(block => block.above()?.isSolid === false)) {
                player.jump();
                player.moveRelative(0, 1, 1);
                // player.applyKnockback(player.getViewDirection().x, player.getViewDirection().z, 0.5, player.getVelocity().y);
            }
            else {
                placeBlockAndJump(playerManager);
            }
        }
        else if (entities.length > 0 && system.currentTick % 5 === 0 && blocks.some(block => block.above()?.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            placeBlockAndJump(playerManager);
        }

        if (entities.length > 0 && distance < 4) {
            const forward = Vector3Builder.from(location)
            .getDirectionTo(target.location)
            .getRotation2d();

            const direction = forward
            .getLocalAxisProvider()
            .getX();

            if (leftOrRight.get(playerManager) === "R") {
                direction.invert();
            }

            player.setRotation(forward);

            playerManager.getAsServerPlayer().selectedSlotIndex = 0;

            if (player.isOnGround) {
                // player.moveRelative(leftOrRight.get(playerManager) === "L" ? 1 : -1, 0, 1); kb使わないと移動遅すぎてだめ 他の値わざわざいじるのもね、、、
                const strength = (playerManager.armor === SimulatedPlayerArmorMaterial.NETHERITE)
                ? baseStrength * 2
                : baseStrength;

                player.applyKnockback(direction.clone().length(strength * (Math.random() / 2 + 1)), player.getVelocity().y);
                player.isSneaking = true;
            }
        }
        else if (entities.length > 0) {
            // near
            if (target.location.y - location.y > 2) {
                player.stopMoving();
                if (system.currentTick % 10 === 0) {
                    player.setRotation(Vector3Builder.from({ x: 0, y: -1, z: 0 }).getRotation2d());
                    player.setItem(new ItemStack(internalCommonConfig.blockMaterial.getAsItemType()), 3, true);
                    placeBlockAndJump(playerManager);
                }
            }
            else {
                if (Math.abs(target.location.y - location.y) <= 2) {
                    player.setItem(new ItemStack(internalCommonConfig.blockMaterial.getAsItemType()), 3, true);
                    placeBlockAsPath(playerManager);
                }

                const v = Vector3Builder.from(location).getDirectionTo(target.location);
                player.setRotation(v.getRotation2d());
                player.moveRelative(0, 1);

                if (system.currentTick % 12 === 0) {
                    if (distance > 5 && distance < 9) {
                        player.setItem(playerManager.projectile.clone(), 2, true);
                        player.useItemInSlot(2);
                    }
                    else if (distance > 14 && distance < 16 && playerManager.canUseEnderPearl) {
                        player.setItem(new ItemStack(Material.ENDER_PEARL.getAsItemType()), 3, true);
                        player.useItemInSlot(3);
                    }
                }

                if (system.currentTick % 20 === 0) {
                    player.isSprinting = true;
                }
            }
        }
        else {
            // far or none
            player.stopMoving();
            player.isSprinting = false;
        }
    }
});

system.runInterval(() => {
    const temporaryBlocks: TemporaryBlock[] = JSON.parse((world.getDynamicProperty("simulated_player:temporary_blocks") ?? "[]") as string);

    for (const info of temporaryBlocks) {
        try {
            const block = world.getDimension(info.dimensionId).getBlock(info.location);

            if (block === undefined) {
                continue;
            }

            if (block.permutation.type.id === internalCommonConfig.blockMaterial.getAsBlockType().id) {
                if (info.seconds > 0) {
                    info.seconds--;
                }
                else {
                    const { x, y, z } = block.location;
                    const items = block.dimension.getEntities({ type: "minecraft:item" });
                    block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
                    block.dimension.getEntities({ type: "minecraft:item" }).forEach(item => {
                        if (!items.includes(item)) {
                            item.remove();
                        }
                    });
                    temporaryBlocks.splice(temporaryBlocks.indexOf(info), 1);
                }
            }
            else {
                temporaryBlocks.splice(temporaryBlocks.indexOf(info), 1);
            }
        }
        catch (e) {
            if (e instanceof UnloadedChunksError || e instanceof LocationOutOfWorldBoundariesError) {
                continue;
            }
            else {
                throw e;
            }
        }
    }

    world.setDynamicProperty("simulated_player:temporary_blocks", JSON.stringify(temporaryBlocks));
}, 20);
