import { Block, BlockVolume, EntityComponentTypes, EntityQueryOptions, EquipmentSlot, GameMode, ItemStack, Player, system, Vector3, world } from "@minecraft/server";
import { register, SimulatedPlayer } from "@minecraft/server-gametest";
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftEntityTypes } from "../lib/@minecraft/vanilla-data/lib/index";
import { Vector3Builder } from "../util/Vector";
import { Material } from "../lib/Material";
import { SimulatedPlayerEventHandlerRegistrar, SimulatedPlayerEventHandlerRegistry } from "./events";
import { SIMULATED_PLAYER_COMMAND_TAG, SimulatedPlayerAIHandlerRegistry, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./enumerations";
import { TemporaryBlockManager, TemporaryBlockPlacementConfig } from "./TemporaryBlock";
import { FORM } from "./form";
import { NoneAIHandler } from "./ai/NoneAIHandler";
import { SimulatedPlayerAIHandler } from "./AI";

/**
 * プレイヤー召喚リクエスト
 */
export interface SimulatedPlayerSpawnRequest {
    /**
     * プレイヤー名
     */
    readonly name: string;

    /**
     * スポーン・リスポーンさせる位置
     */
    readonly respawnPoint?: Vector3;

    /**
     * ゲームモード(サバイバル推奨)
     */
    readonly gameMode?: GameMode;

    /**
     * プレイヤーが作成された瞬間実行される関数
     * @param manager 作成されたプレイヤーを表現する`SimulatedPlayerManager`クラスのインスタンス
     * @param timeTakenToSpawn リクエスト送信から作成までにかかった時間
     */
    onCreate?(manager: SimulatedPlayerManager, timeTakenToSpawn: number): void;
}

interface SimulatedPlayerSpawnRequestInternalInfo extends SimulatedPlayerSpawnRequest {
    readonly time: number;

    newManager(player: SimulatedPlayer): SimulatedPlayerManager;
}

const nextSpawnRequestQueue: SimulatedPlayerSpawnRequestInternalInfo[] = [];

let canBeAddedToQueue: boolean = true;

register("simulated_player", "", test => {
    if (nextSpawnRequestQueue.length === 0) {
        throw new Error();
    }

    const request = nextSpawnRequestQueue.shift()!;

    const player = test.spawnSimulatedPlayer(
        { x: 0, y: 0, z: 0 },
        request.name,
        request.gameMode ?? GameMode.survival
    );

    player.addTag(SIMULATED_PLAYER_COMMAND_TAG);

    const manager = request.newManager(player);

    if (request.respawnPoint) manager.setRespawnPoint(request.respawnPoint);

    if (typeof request.onCreate === "function") {
        request.onCreate(manager, Date.now() - request.time);
    }

    canBeAddedToQueue = true;
})
.structureName("simulated_player:")
.maxTicks(2147483647);

/**
 * SimulatedPlayer操作のメインクラス
 */
export class SimulatedPlayerManager {
    private readonly player: SimulatedPlayer;

    private __reloading__: boolean = false;

    private __armor__: SimulatedPlayerArmorMaterial = SimulatedPlayerArmorMaterial.NONE;

    private __weapon__: SimulatedPlayerWeaponMaterial = SimulatedPlayerWeaponMaterial.NONE;

    private __auxiliary__: SimulatedPlayerAuxiliary = SimulatedPlayerAuxiliary.NONE;

    private __projectile__: ItemStack = new ItemStack(Material.SNOWBALL.getAsItemType());

    private __canUseEnderPearl__: boolean = true;

    private __ai__: SimulatedPlayerAIHandler = NoneAIHandler.get(this);

    private __respawnPoint__: Vector3Builder = Vector3Builder.from(world.getDefaultSpawnLocation()).add({ x: 0.5, y: 0.0, z: 0.5 });

    private constructor(player: SimulatedPlayer) {
        this.player = player;
        SimulatedPlayerManager.__instanceSet__.add(this);

        const that = this;

        Object.defineProperties(player, {
            getSpawnPoint: {
                get() {
                    return () => ({ dimension: that.getAsServerPlayer().dimension, ...that.getRespawnPoint() });
                },
                set(value) {
                    throw new TypeError();
                }
            },
            setSpawnPoint: {
                get() {
                    return () => {
                        throw new Error("SimulatedPlayerManagerの管理下に置かれたインスタンスへの直接のリスポーンポイント操作は禁じられています");
                    }
                },
                set(value) {
                    throw new TypeError();
                }
            }
        });
    }

    /**
     * このインスタンスが表現するプレイヤーを`SimulatedPlayer`として取得する関数
     */
    public getAsGameTestPlayer(): SimulatedPlayer {
        return this.player;
    }

    /**
     * このインスタンスが表現するプレイヤーを`Player`として取得する関数
     */
    public getAsServerPlayer(): Player {
        return world.getPlayers().filter(player => player.id === this.player.id)[0];
    }

    /**
     * このインスタンスのAIを操作するオブジェクトを返す関数
     */
    public getAIHandler(): SimulatedPlayerAIHandler {
        return this.__ai__;
    }

    /**
     * このインスタンスのAIを操作するオブジェクトを文字列IDで指定して設定する関数
     * @param id AIハンドラのID
     */
    public setAIHandler(id: string): void {
        this.__ai__ = SimulatedPlayerAIHandlerRegistry.getHandlerById(id, this);
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
            equippable.setEquipment(EquipmentSlot.Chest);
            equippable.setEquipment(EquipmentSlot.Legs);
            equippable.setEquipment(EquipmentSlot.Feet);
        }
        else {
            equippable.setEquipment(EquipmentSlot.Head, new ItemStack(this.__armor__ + "_helmet"));
            equippable.setEquipment(EquipmentSlot.Chest, new ItemStack(this.__armor__ + "_chestplate"));
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
     * リスポーンポイントを取得する関数
     */
    public getRespawnPoint(): Vector3Builder {
        return this.__respawnPoint__.clone();
    }

    /**
     * リスポーンポイントを設定する関数
     */
    public setRespawnPoint(location: Vector3): void {
        this.__respawnPoint__ = Vector3Builder.from(location);
    }

    /**
     * `Player#isValid && SimulatedPlayer#isValid`を返す関数
     */
    public isValid(): boolean {
        return this.player.isValid && this.getAsServerPlayer().isValid;
    }

    /**
     * 死亡していれば`true`
     */
    public isDead(): boolean {
        if (!this.isValid()) {
            throw new Error();
        }

        return this.getAsServerPlayer().dimension.getEntities({
            type: MinecraftEntityTypes.Player,
            name: this.getAsServerPlayer().name,
            tags: [SIMULATED_PLAYER_COMMAND_TAG]
        }).length === 0;
    }

    /**
     * 装備を新品のものと取り替える
     */
    public repairEquipment(): void {
        if (!this.isValid()) {
            throw new Error();
        }

        this.armor = this.armor;
        this.weapon = this.weapon;
        this.auxiliary = this.auxiliary;
    }

    /**
     * もやんがちゃんとしてくれればこんなのいらないのにね！！！！！！！！！！！！
     */
    public async reload(): Promise<void> {
        if (this.__reloading__) throw new Error("still reloading");

        if (!this.isValid()) {
            throw new Error();
        }

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

    /**
     * このインスタンスに対応するプレイヤーを編集するためのフォームを開く
     * @param player フォームを開くプレイヤー
     */
    public openConfigUI(player: Player) {
        if (!this.isValid()) {
            throw new Error();
        }

        FORM.config(this).open(player);
    }

    /**
     * 任意の場所に任意のブロックを設置させる関数
     * @param block 設置位置となるブロック
     * @param config ブロックの設定
     */
    public placeBlockAt(block: Block, config: TemporaryBlockPlacementConfig) {
        if (!this.isValid()) {
            throw new Error();
        }

        this.getAsGameTestPlayer().attack();

        TemporaryBlockManager.tryPlace(block, config);

        SimulatedPlayerEventHandlerRegistry.get("onPlaceBlock").fireEvent({
            "simulatedPlayerManager": this,
            "block": block
        });
    }

    /**
     * その場で任意のブロックを積み上げさせる関数
     * @param config ブロックの設定
     */
    public pileUpBlock(config: TemporaryBlockPlacementConfig) {
        if (!this.isValid()) {
            throw new Error();
        }

        const player = this.getAsGameTestPlayer();
        const location = this.getAsServerPlayer().location;
        const block = this.getAsServerPlayer().dimension.getBlock(location)!;
    
        player.jump();
        player.setRotation(Vector3Builder.down().getRotation2d());
    
        system.runTimeout(() => {
            if (!this.isValid()) return;
    
            player.stopMoving();
            player.isSprinting = false;
            this.placeBlockAt(block, config);
        }, 6);
    }

    /**
     * 足元に足場として任意のブロックを設置させる関数
     * @param config ブロックの設定
     */
    public placePathBlock(config: TemporaryBlockPlacementConfig) {
        if (!this.isValid()) {
            throw new Error();
        }

        const player = this.getAsGameTestPlayer();
        const location = this.getAsServerPlayer().location;
        const block = this.getAsServerPlayer().dimension.getBlock(location)?.below();
    
        if (block === undefined) return;
    
        if (!block.isSolid && !block.below()?.isSolid && player.isOnGround) {
            this.placeBlockAt(block, config);
        }
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

    private static async waitToBeAddedToQueue(request: SimulatedPlayerSpawnRequestInternalInfo): Promise<void> {
        if (canBeAddedToQueue) {
            nextSpawnRequestQueue.push(request);
            canBeAddedToQueue = false;
            world.getDimension(MinecraftDimensionTypes.Overworld).fillBlocks(
                new BlockVolume({ x: -2, y: -60, z: 100000 }, { x: 3, y: 319, z: 100006 }),
                MinecraftBlockTypes.Air,
                { ignoreChunkBoundErrors: true }
            );
            world.getDimension(MinecraftDimensionTypes.Overworld).runCommand("execute positioned 0.0 0.0 100000.0 run gametest run \"simulated_player:\"");
        }
        else {
            await system.waitTicks(1);
            return this.waitToBeAddedToQueue(request);
        }
    }

    /**
     * 条件に一致する`SimulatedPlayerManager`をすべて取得する
     * @param options `EntityQueryOptions`が使えるよ
     */
    public static getManagers(options?: EntityQueryOptions): Set<SimulatedPlayerManager> {
        const set: Set<SimulatedPlayerManager> = new Set();

        for (const playerManager of this.__instanceSet__) {
            if (playerManager.isValid()) {
                if (options === undefined) {
                    set.add(playerManager);
                }
                else if (playerManager.getAsServerPlayer().matches(options)) {
                    set.add(playerManager);
                }
            }
            else {
                this.__instanceSet__.delete(playerManager);
            }
        }

        return set;
    }

    /**
     * `Entity#id`からこのクラスのインスタンスを取得する関数
     * @param id `Entity#id`で取れる文字列
     * @returns 見つからなければ`undefined`
     */
    public static getByEntityId(id: string): SimulatedPlayerManager | undefined {
        for (const playerManager of this.__instanceSet__) {
            if (playerManager.player.id === id && playerManager.isValid()) {
                return playerManager;
            }
        }

        return undefined;
    }

    /**
     * `SimulatedPlayer`に関するイベントを登録したり登録解除できたりするやつ
     */
    public static readonly events: SimulatedPlayerEventHandlerRegistrar = {
        on(event, listener) {
            return SimulatedPlayerEventHandlerRegistry.get(event).registerCallback(listener);
        },

        off(id) {
            SimulatedPlayerEventHandlerRegistry.unregisterCallback(id);
        }
    };

    private static readonly __instanceSet__: Set<SimulatedPlayerManager> = new Set();

    /**
     * このクラスをフォームとしてプレイヤーに表示する関数
     * @param player フォームを表示する対象
     */
    public static openManagerUI(player: Player) {
        FORM.main().open(player);
    }
}

world.afterEvents.entityHealthChanged.subscribe(event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.entity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

    const maxHealth = manager.getAsServerPlayer().getComponent(EntityComponentTypes.Health)!.effectiveMax;

    const value = Math.floor(clamp(event.newValue, 0, maxHealth) * 10) / 10;

    manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f${value}`;

    SimulatedPlayerEventHandlerRegistry.get("onHealthChange").fireEvent({
        "currentValue": event.newValue,
        "previousValue": event.oldValue,
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.entityDie.subscribe(event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.deadEntity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    SimulatedPlayerEventHandlerRegistry.get("onDie").fireEvent({
        "damageSource": event.damageSource,
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.playerSpawn.subscribe(event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.player.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    manager.getAsGameTestPlayer().teleport(manager.getRespawnPoint());

    manager.getAsServerPlayer().selectedSlotIndex = 0;

    system.runTimeout(() => {
        manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f20`;
    });

    SimulatedPlayerEventHandlerRegistry.get("onSpawn").fireEvent({
        "simulatedPlayerManager": manager
    });
});

// afterだと既にgetById()で取得不可能になっているためbeforeで
world.beforeEvents.playerLeave.subscribe(event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.player.id);

    if (manager === undefined) return;

    SimulatedPlayerEventHandlerRegistry.get("onBeforeLeave").fireEvent({
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.entityHurt.subscribe(event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.hurtEntity.id);

    if (manager === undefined) return;

    SimulatedPlayerEventHandlerRegistry.get("onHurt").fireEvent({
        "simulatedPlayerManager": manager,
        "damageAmount": event.damage,
        "damageSource": event.damageSource
    });
});

world.afterEvents.entityHurt.subscribe(event => {
    const damager = event.damageSource.damagingEntity;

    if (damager === undefined) return;

    const manager = SimulatedPlayerManager.getByEntityId(damager.id);

    if (manager === undefined) return;

    SimulatedPlayerEventHandlerRegistry.get("onAttack").fireEvent({
        "simulatedPlayerManager": manager,
        "target": event.hurtEntity,
        "damage": event.damage,
        "cause": event.damageSource.cause
    });
});

world.beforeEvents.playerInteractWithEntity.subscribe(async event => {
    const manager = SimulatedPlayerManager.getByEntityId(event.target.id);

    if (manager === undefined) return;

    await Promise.resolve();

    SimulatedPlayerEventHandlerRegistry.get("onInteractedByPlayer").fireEvent({
        "simulatedPlayerManager": manager,
        "interacter": event.player
    });
});
