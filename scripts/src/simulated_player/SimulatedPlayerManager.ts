import { Block, EntityComponentTypes, EntityQueryOptions, EquipmentSlot, GameMode, ItemStack, Player, system, Vector3, world } from "@minecraft/server";

import { register, SimulatedPlayer } from "@minecraft/server-gametest";

import { MinecraftDimensionTypes, MinecraftEntityTypes } from "../lib/@minecraft/vanilla-data/lib/index";

import { ActionFormWrapper, MessageFormWrapper, ModalFormWrapper } from "../lib/UI-2.0";
import { Vector3Builder } from "../util/Vector";
import { Material } from "../lib/Material";
import { RandomHandler } from "../util/Random";
import { SimulatedPlayerEventHandlerRegistrar, SimulatedPlayerEventHandlerRegistry } from "./events";
import { ENEMIES_FOR_SIMULATED_PLAYER, SIMULATED_PLAYER_BASE_SPEED, SIMULATED_PLAYER_COMMAND_TAG, SIMULATED_PLAYER_DEFAULT_NAME, SimulatedPlayerAI, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./enumerations";
import { TemporaryBlockManager, TemporaryBlockPlacementConfig } from "./TemporaryBlock";

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

    player.addTag(SIMULATED_PLAYER_COMMAND_TAG);

    const manager = request.newManager(player);

    if (request.respawnPoint) manager.setRespawnPoint(request.respawnPoint);

    if (typeof request.onCreate === "function") {
        request.onCreate(manager, Date.now() - request.time);
        ok = true;
    }
})
.structureName("simulated_player:")
.maxTicks(2147483647);

interface SimulatedPlayerCommonConfig {
    /**
     * プレイヤーの球形索敵範囲の半径
     */
    followRange: number;

    /**
     * プレイヤーが設置するブロック
     */
    readonly block: TemporaryBlockPlacementConfig;
}

type DirectionLeftRight = "LEFT" | "RIGHT";

interface SimulatedPlayerBehaviorState {
    fallingTicks: number;

    directionToMoveAround: DirectionLeftRight;

    preparingForAttack: boolean;
}

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

    private __ai__: SimulatedPlayerAI = SimulatedPlayerAI.NONE;

    private __respawnPoint__: Vector3Builder = Vector3Builder.from(world.getDefaultSpawnLocation()).add({ x: 0.5, y: 0.5, z: 0.5 });

    /**
     * 外部からの操作は非推奨
     */
    public readonly behaviorState: SimulatedPlayerBehaviorState = {
        fallingTicks: 0,
        directionToMoveAround: RandomHandler.choice(["LEFT", "RIGHT"]),
        preparingForAttack: false
    };

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

    public getRespawnPoint(): Vector3Builder {
        return this.__respawnPoint__.clone();
    }

    public setRespawnPoint(location: Vector3): void {
        this.__respawnPoint__ = Vector3Builder.from(location);
    }

    /**
     * Player#isValid() && SimulatedPlayer#isValid()を返す関数
     */
    public isValid(): boolean {
        return this.player.isValid && this.getAsServerPlayer().isValid;
    }

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
    public openConfigForm(player: Player) {
        if (!this.isValid()) {
            throw new Error();
        }

        SimulatedPlayerManager.FORM.config(this).open(player);
    }

    public placeBlockAt(block: Block) {
        if (!this.isValid()) {
            throw new Error();
        }

        this.getAsGameTestPlayer().attack();

        TemporaryBlockManager.tryPlace(block, SimulatedPlayerManager.commonConfig.block.material);

        SimulatedPlayerEventHandlerRegistry.get("onPlaceBlock").call({
            "simulatedPlayerManager": this,
            "block": block
        });
    }

    public pileUpBlock() {
        if (!this.isValid()) {
            throw new Error();
        }

        const player = this.getAsGameTestPlayer();
        const location = this.getAsServerPlayer().location;
        const block = this.getAsServerPlayer().dimension.getBlock(location)!;
    
        player.jump();
    
        system.runTimeout(() => {
            if (!this.isValid()) return;
    
            player.stopMoving();
            player.isSprinting = false;
            this.placeBlockAt(block);
        }, 6);
    }

    public placePathBlock() {
        if (!this.isValid()) {
            throw new Error();
        }

        const player = this.getAsGameTestPlayer();
        const location = this.getAsServerPlayer().location;
        const block = this.getAsServerPlayer().dimension.getBlock(location)?.below();
    
        if (block === undefined) return;
    
        if (!block.isSolid && !block.below()?.isSolid && player.isOnGround) {
            this.placeBlockAt(block);
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
     * Entity#idからこのクラスのインスタンスを取得する関数
     * @param id Entity#idで取れる文字列
     * @returns 見つからなければundefined
     */
    public static getById(id: string): SimulatedPlayerManager | undefined {
        for (const playerManager of this.__instanceSet__) {
            if (playerManager.player.id === id && playerManager.isValid()) {
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

    private static readonly __instanceSet__: Set<SimulatedPlayerManager> = new Set();

    private static readonly __commonConfig__: SimulatedPlayerCommonConfig = {
        followRange: 30,
        block: {
            material: Material.COBBLESTONE,
            lifespanSeconds: 3
        }
    };

    /**
     * すべてのSimulatedPlayerに共通する設定を扱う
     */
    public static readonly commonConfig: SimulatedPlayerCommonConfig = {
        get followRange(): number {
            return SimulatedPlayerManager.__commonConfig__.followRange;
        },

        set followRange(value) {
            if (typeof value === "number" && !Number.isNaN(value) && Number.isInteger(value)) {
                SimulatedPlayerManager.__commonConfig__.followRange = value;
            }
            else throw new TypeError();
        },

        block: {
            get material() {
                return SimulatedPlayerManager.__commonConfig__.block.material;
            },

            set material(value) {
                if (!value.isBlock) {
                    throw new TypeError();
                }
    
                SimulatedPlayerManager.__commonConfig__.block.material = value;
            },

            get lifespanSeconds(): number {
                return SimulatedPlayerManager.__commonConfig__.block.lifespanSeconds;
            },
    
            set lifespanSeconds(value) {
                if (typeof value === "number" && !Number.isNaN(value) && Number.isInteger(value)) {
                    SimulatedPlayerManager.__commonConfig__.block.lifespanSeconds = value;
                }
                else throw new TypeError();
            }
        }
    };

    /**
     * このクラスをフォームとしてプレイヤーに表示する関数
     * @param player フォームを表示する対象
     */
    public static openManagerForm(player: Player) {
        SimulatedPlayerManager.FORM.main().open(player);
    }

    private static readonly FORM = {
        main(): ActionFormWrapper {
            return new ActionFormWrapper()
            .title("Simulated Player Manager")
            .button({
                name: "§a召喚",
                iconPath: "textures/ui/color_plus",
                on(player) {
                    SimulatedPlayerManager.FORM.spawn().open(player);
                }
            })
            .button({
                name: "§9コンフィグ",
                iconPath: "textures/ui/settings_glyph_color_2x",
                on(player) {
                    SimulatedPlayerManager.FORM.list(manager => {
                        SimulatedPlayerManager.FORM.config(manager).open(player);
                    }).open(player);
                }
            })
            .button({
                name: "§3再読み込み",
                iconPath: "textures/items/ender_pearl",
                on(player) {
                    SimulatedPlayerManager.FORM.list(manager => {
                        SimulatedPlayerManager.FORM.reload(manager);
                        SimulatedPlayerManager.FORM.main().open(player);
                    }).open(player);
                }
            })
            .button({
                name: "§c削除",
                iconPath: "textures/ui/trash_default",
                on(player) {
                    SimulatedPlayerManager.FORM.list(manager => {
                        SimulatedPlayerManager.FORM.delete(manager).open(player);
                    }).open(player);
                }
            })
            .button({
                name: "§4全プレイヤーを削除",
                iconPath: "textures/ui/realms_red_x",
                on(player) {
                    SimulatedPlayerManager.FORM.deleteAll().open(player);
                }
            })
        },
    
        spawn(): ModalFormWrapper {
            return new ModalFormWrapper()
            .title("Spawn Simulated Player")
            .textField({
                id: "name",
                label: "プレイヤー名",
                placeHolder: "ここにプレイヤー名を入力",
                defaultValue: SIMULATED_PLAYER_DEFAULT_NAME
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
                    manager.getAsGameTestPlayer().disconnect();
                }
            })
            .button2({
                name: "n",
                on(player) {
                    SimulatedPlayerManager.FORM.main().open(player);
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
                    SimulatedPlayerManager.getManagers().forEach(manager => manager.getAsGameTestPlayer().disconnect());
                }
            })
            .button2({
                name: "n",
                on(player) {
                    SimulatedPlayerManager.FORM.main().open(player);
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

            list.divider({ id: "div" });
    
            list.button({
                name: "Back",
                iconPath: "textures/ui/back_button_default",
                on(player) {
                    SimulatedPlayerManager.FORM.main().open(player);
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
    } as const;
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

    SimulatedPlayerEventHandlerRegistry.get("onDie").call({
        "damageSource": event.damageSource,
        "simulatedPlayerManager": manager
    });
});

world.afterEvents.playerSpawn.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.player.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    manager.getAsGameTestPlayer().teleport(manager.getRespawnPoint());

    manager.getAsServerPlayer().selectedSlotIndex = 0;

    system.runTimeout(() => {
        manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f20`;
    });

    SimulatedPlayerEventHandlerRegistry.get("onSpawn").call({
        "simulatedPlayerManager": manager
    });
});

// afterだと既にgetById()で取得不可能になっているためbeforeで
world.beforeEvents.playerLeave.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.player.id);

    if (manager === undefined) return;

    world.sendMessage([
        { text: "§e" },
        {
            translate: "multiplayer.player.left",
            with: [event.player.name]
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

system.runInterval(() => {
    for (const playerManager of SimulatedPlayerManager.getManagers()) {
        if (playerManager.getAsGameTestPlayer().isFalling) {
            playerManager.behaviorState.fallingTicks++;
        }
        else {
            playerManager.behaviorState.fallingTicks = 0;
        }

        if (playerManager.ai !== SimulatedPlayerAI.COMBAT) {
            if (system.currentTick % 30 === 0) {
                playerManager.getAsGameTestPlayer().stopMoving();
                playerManager.getAsGameTestPlayer().isSprinting = false;
            }
            continue;
        }

        if (playerManager.isDead()) continue;

        const location = playerManager.getAsServerPlayer().location;

        const player = playerManager.getAsGameTestPlayer();

        const serverPlayer = playerManager.getAsServerPlayer();

        const entities = player.dimension.getEntities({ location: location, maxDistance: SimulatedPlayerManager.commonConfig.followRange, excludeTypes: ENEMIES_FOR_SIMULATED_PLAYER })
        .filter(entity => {
            if (entity.id === player.id) return false;

            if (entity instanceof Player) {
                return entity.getGameMode() !== GameMode.creative;
            }

            return true;
        });

        const target = entities[0];

        const distance = target ? Vector3Builder.from(location).getDistanceTo(target.location) : 0;

        if (player.isSneaking && !playerManager.behaviorState.preparingForAttack) {
            playerManager.behaviorState.preparingForAttack = true;
            system.runTimeout(() => {
                if (!player.isValid) return;
                // ジャンプしてスニークしてhandled = false;
                player.jump();
                player.isSneaking = false;
                playerManager.behaviorState.preparingForAttack = false;
            }, 10);
        }

        if (entities.length > 0 && distance < 5) {
            const direction = Vector3Builder.from(location).getDirectionTo(target.location);
            const dist = Vector3Builder.from(location).getDistanceTo(target.location);
            const rayCastResultFeet = serverPlayer.dimension.getBlockFromRay(location, direction, { maxDistance: dist + 1 });
            const rayCastResultEyes = serverPlayer.dimension.getBlockFromRay(serverPlayer.getHeadLocation(), direction, { maxDistance: dist + 1 });

            if (playerManager.behaviorState.fallingTicks > 1 && (rayCastResultEyes === undefined || rayCastResultFeet === undefined)) {
                serverPlayer.selectedSlotIndex = 0;
                const r = player.attackEntity(target);
                if (r) {
                    playerManager.behaviorState.directionToMoveAround = RandomHandler.choice(["LEFT", "RIGHT"]);
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
                playerManager.pileUpBlock();
            }
        }
        else if (entities.length > 0 && system.currentTick % 5 === 0 && blocks.some(block => block.above()?.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            playerManager.pileUpBlock();
        }

        if (entities.length > 0 && distance < 4) {
            const forward = Vector3Builder.from(location)
            .getDirectionTo(target.location)
            .getRotation2d();

            const direction = forward
            .getLocalAxisProvider()
            .getX();

            if (playerManager.behaviorState.directionToMoveAround === "RIGHT") {
                direction.invert();
            }

            player.setRotation(forward);

            playerManager.getAsServerPlayer().selectedSlotIndex = 0;

            if (player.isOnGround) {
                // player.moveRelative(leftOrRight.get(playerManager) === "L" ? 1 : -1, 0, 1); kb使わないと移動遅すぎてだめ 他の値わざわざいじるのもね、、、
                const strength = (playerManager.armor === SimulatedPlayerArmorMaterial.NETHERITE)
                ? SIMULATED_PLAYER_BASE_SPEED * 2
                : SIMULATED_PLAYER_BASE_SPEED;

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
                    player.setItem(new ItemStack(SimulatedPlayerManager.commonConfig.block.material.getAsItemType()), 3, true);
                    playerManager.pileUpBlock();
                }
            }
            else {
                if (Math.abs(target.location.y - location.y) <= 2) {
                    player.setItem(new ItemStack(SimulatedPlayerManager.commonConfig.block.material.getAsItemType()), 3, true);
                    playerManager.placePathBlock();
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
