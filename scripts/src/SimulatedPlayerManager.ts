import { Block, Entity, EntityComponentTypes, EntityDamageCause, EntityDamageSource, EntityQueryOptions, EquipmentSlot, GameMode, ItemStack, LocationOutOfWorldBoundariesError, Player, System, system, UnloadedChunksError, Vector3, world } from "@minecraft/server";

import { register, SimulatedPlayer } from "@minecraft/server-gametest";

import { MinecraftDimensionTypes } from "./lib/@minecraft/vanilla-data/lib/index";

import { ActionFormWrapper, MessageFormWrapper, ModalFormWrapper } from "./lib/UI";
import { Vector3Builder } from "./util/Vector";
import { Material } from "./lib/Material";
import { RandomHandler } from "./util/Random";

export interface SimulatedPlayerSpawnRequest {
    readonly name: string;

    readonly spawnPoint?: Vector3;

    readonly gameMode?: GameMode;

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

    const request = nextSpawnRequestQueue.shift();

    const player = test.spawnSimulatedPlayer(
        { x: 0, y: 0, z: 0 },
        request.name,
        request.gameMode ?? GameMode.survival
    );

    player.teleport(request.spawnPoint ?? Vector3Builder.from(world.getDefaultSpawnLocation()).add({ x: 0.5, y: 0.5, z: 0.5 }));

    if (typeof request.onCreate === "function") {
        request.onCreate(request.newManager(player), Date.now() - request.time);
        ok = true;
    }
})
.structureName("simulated_player:")
.maxTicks(2147483647);

interface SimulatedPlayerEventHandlerRegistrar {
    on<T extends keyof SimulatedPlayerEventTypes>(event: T, listener: (event: SimulatedPlayerEventTypes[T]) => void): number;

    off(id: number): void;
}

interface SimulatedPlayerEvent {
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

type SimulatedPlayerEventTypes = {
    readonly onHealthChange: SimulatedPlayerHealthChangeEvent;

    readonly onDie: SimulatedPlayerDieEvent;

    readonly onSpawn: SimulatedPlayerSpawnEvent;

    readonly onHurt: SimulatedPlayerHurtEvent;

    readonly onPlaceBlock: SimulatedPlayerPlaceBlockEvent;

    readonly onAttack: SimulatedPlayerAttackEntityEvent;
}

interface SimulatedPlayerCommonConfig {
    blockLifespanSeconds: number;

    followRange: number;

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

export enum SimulatedPlayerAI {
    NONE = "none",
    COMBAT = "combat"
}

export class SimulatedPlayerManager {
    private readonly player: SimulatedPlayer;

    private __armor__: SimulatedPlayerArmorMaterial = SimulatedPlayerArmorMaterial.NONE;

    private __weapon__: SimulatedPlayerWeaponMaterial = SimulatedPlayerWeaponMaterial.NONE;

    private __projectile__: ItemStack = new ItemStack(Material.SNOWBALL.getAsItemType());

    private __canUseEnderPearl__: boolean = true;

    private __ai__: SimulatedPlayerAI = SimulatedPlayerAI.NONE;

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

    public getAsGameTestPlayer(): SimulatedPlayer {
        return this.player;
    }

    public getAsServerPlayer(): Player {
        return world.getPlayers().filter(player => player.id === this.player.id)[0];
    }

    public get armor(): SimulatedPlayerArmorMaterial {
        return this.__armor__;
    }

    public set armor(value) {
        this.__armor__ = value;
        const equippable = this.getAsServerPlayer().getComponent(EntityComponentTypes.Equippable);
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

    public get weapon(): SimulatedPlayerWeaponMaterial {
        return this.__weapon__;
    }

    public set weapon(value) {
        this.__weapon__ = value;
        if (this.__weapon__ === "none") {
            this.getAsServerPlayer().getComponent(EntityComponentTypes.Inventory).container.setItem(0);
            this.getAsServerPlayer().selectedSlotIndex = 0;
        }
        else {
            this.getAsServerPlayer().getComponent(EntityComponentTypes.Inventory).container.setItem(0, new ItemStack(this.__weapon__ + "_sword"));
            this.getAsServerPlayer().selectedSlotIndex = 0;
        }
    }

    public get projectile(): ItemStack {
        return this.__projectile__;
    }

    public set projectile(value) {
        this.__projectile__ = value;
    }

    public get canUseEnderPearl(): boolean {
        return this.__canUseEnderPearl__;
    }

    public set canUseEnderPearl(value) {
        this.__canUseEnderPearl__ = value;
    }

    public isValid(): boolean {
        return this.player.isValid() && this.getAsServerPlayer().isValid();
    }

    public static requestSpawnPlayer(request: SimulatedPlayerSpawnRequest): void {
        this.requestInternal({
            time: Date.now(),
            newManager(player) {
                return new SimulatedPlayerManager(player);
            },
            ...request
        });
    }

    private static requestInternal(request: SimulatedPlayerSpawnRequestInternalInfo) {
        if (ok) {
            nextSpawnRequestQueue.push(request);
            ok = false;
            world.getDimension(MinecraftDimensionTypes.Overworld).runCommand("execute positioned 0.0 0.0 100000.0 run gametest run simulated_player:spawn");
        }
        else {
            system.run(() => {
                this.requestInternal(request);
            });
        }
    }

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

    public static getById(id: string): SimulatedPlayerManager | undefined {
        for (const playerManager of simulatedPlayerManagers) {
            if (playerManager.player.id === id) {
                return playerManager;
            }
        }

        return undefined;
    }

    public static readonly events: SimulatedPlayerEventHandlerRegistrar = {
        on(event, listener) {
            return SimulatedPlayerEventHandlerRegistry.get(event).add(listener);
        },

        off(id) {
            SimulatedPlayerEventHandlerRegistry.remove(id);
        }
    };

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

    public static showAsForm(player: Player) {
        form.main().open(player);
    }
}

const internalCommonConfig: SimulatedPlayerCommonConfig = {
    blockLifespanSeconds: 3,
    followRange: 20,
    blockMaterial: Material.COBBLESTONE
}

const form = {
    main(): ActionFormWrapper {
        return new ActionFormWrapper()
        .title("Simulated Player Manager")
        .button("§a召喚", "textures/ui/color_plus", player => {
            form.spawn().open(player);
        })
        .button("§9コンフィグ", "textures/ui/settings_glyph_color_2x", player => {
            form.list(manager => {
                form.config(manager).open(player);
            }).open(player);
        })
        .button("§c削除", "textures/ui/trash_default", player => {
            form.list(manager => {
                form.delete(manager).open(player);
            }).open(player);
        });
    },

    spawn(): ModalFormWrapper {
        return new ModalFormWrapper()
        .title("Spawn Simulated Player")
        .textField("name", "プレイヤー名", "おなまえ", "Steve")
        .onSubmit(event => {
            SimulatedPlayerManager.requestSpawnPlayer({
                name: event.getTextField("name"),
                onCreate(player, time) {
                    player.ai = SimulatedPlayerAI.COMBAT;
                    console.warn(player.getAsServerPlayer().name + " joined. (" + time + "ms)");
                }
            });
        });
    },

    delete(manager: SimulatedPlayerManager): MessageFormWrapper {
        return new MessageFormWrapper()
        .title("Delete Simulated Player")
        .body(manager.getAsGameTestPlayer().name + "を削除しますか？")
        .button1("y")
        .button2("n")
        .onPush(b => b.name === "y", event => {
            manager.getAsGameTestPlayer().disconnect();
        });
    },

    list(callback: (manager: SimulatedPlayerManager) => void): ActionFormWrapper {
        const list = new ActionFormWrapper();
        list.title("List of Simulated Player");
        for (const player of SimulatedPlayerManager.getManagers()) {
            list.button("§6" + player.getAsGameTestPlayer().name, ["player", player.getAsGameTestPlayer().id]);
        }
        list.button("Back", "textures/ui/back_button_default", player => {
            form.main().open(player);
        })
        .onPush(button => button.tags.includes("player"), event => {
            const manager = SimulatedPlayerManager.getById(event.button.tags[1]);
            if (manager === undefined) return;
            callback(manager);
        });
        return list;
    },

    config(manager: SimulatedPlayerManager): ModalFormWrapper {
        const armors = ["none", "leather", "golden", "chainmail", "iron", "diamond", "netherite"];
        const weapons = ["none", "wooden", "stone", "iron", "diamond", "netherite"];
        return new ModalFormWrapper()
        .title("Simulated Player Config")
        .dropdown("armor", "防具", armors, armors.indexOf(manager.armor))
        .dropdown("weapon", "近接武器", weapons, weapons.indexOf(manager.weapon))
        .dropdown("offHand", "オフハンド", ["none", "shield", "totem_of_undying"])
        .dropdown("ai", "AI", Object.values(SimulatedPlayerAI).map(e => e.toLowerCase()), Object.values(SimulatedPlayerAI).indexOf(manager.ai))
        .onSubmit(event => {
            const offHand = event.getDropdown("offHand");
            const equippable = manager.getAsServerPlayer().getComponent(EntityComponentTypes.Equippable);

            manager.ai = SimulatedPlayerAI[event.getDropdown("ai").toUpperCase()];
            manager.armor = event.getDropdown("armor") as SimulatedPlayerArmorMaterial;
            manager.weapon = event.getDropdown("weapon") as SimulatedPlayerWeaponMaterial;

            if (offHand === "none") {
                equippable.setEquipment(EquipmentSlot.Offhand);
            }
            else {
                equippable.setEquipment(EquipmentSlot.Offhand, new ItemStack(offHand));
            }
        });
    }
};

const simulatedPlayerManagers: Set<SimulatedPlayerManager> = new Set();

class SimulatedPlayerEventHandlerRegistry<T extends keyof SimulatedPlayerEventTypes> {
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

    public static get<T extends keyof SimulatedPlayerEventTypes>(event: T): SimulatedPlayerEventHandlerRegistry<T> | undefined {
        for (const registry of this.__registries__) {
            if (registry.__name__ === event) return registry as SimulatedPlayerEventHandlerRegistry<T>;
        }
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
}

world.afterEvents.entityHealthChanged.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.entity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    const value = event.newValue < 0 ? 0 : Math.floor(event.newValue * 10) / 10;

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

system.runInterval(() => {
    for (const playerManager of SimulatedPlayerManager.getManagers()) {
        function placeBlockAndJump() {
            const block = playerManager.getAsServerPlayer().dimension.getBlock(location);
            player.jump();
            system.runTimeout(() => {
                if (!player.isValid()) return;

                player.stopMoving();
                player.isSprinting = false;
                putTemporaryBlock(playerManager, block);
            }, 6);
        }

        function placeBlockAsPath() {
            const block = playerManager.getAsServerPlayer().dimension.getBlock(location).below();
            if (!block.isSolid && !block.below().isSolid && player.isOnGround) {
                putTemporaryBlock(playerManager, block);
            }
        }

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

        if (!playerManager.ai) {
            if (system.currentTick % 20 === 0) {
                playerManager.getAsGameTestPlayer().stopMoving();
                playerManager.getAsGameTestPlayer().isSprinting = false;
            }
            continue;
        }

        const location = playerManager.getAsServerPlayer().location;

        const player = playerManager.getAsGameTestPlayer();

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
                if (!player.isValid()) return;
                player.jump();
                player.isSneaking = false;
                handledMap.set(playerManager, false);
            }, 10);
        }

        if (entities.length > 0 && distance < 5) {
            if ((simulatedPlayerFallingTicks.get(playerManager) ?? 0) > 1 && player.getEntitiesFromViewDirection({ maxDistance: 5 }) !== undefined) {
                const r = player.attackEntity(target);
                if (r) {
                    leftOrRight.set(playerManager, RandomHandler.chance() ? "L" : "R");
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

        if (system.currentTick % 3 === 0 && blocks.some(block => block.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            if (blocks.every(block => block.above().isSolid === false)) {
                player.jump();
                player.applyKnockback(player.getViewDirection().x, player.getViewDirection().z, 0.5, player.getVelocity().y);
            }
            else {
                placeBlockAndJump();
            }
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
                player.applyKnockback(direction.x, direction.z, 0.65, player.getVelocity().y);
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
                    placeBlockAndJump();
                }
            }
            else {
                if (Math.abs(target.location.y - location.y) <= 2) {
                    placeBlockAsPath();
                }

                const v = Vector3Builder.from(location).getDirectionTo(target.location);
                player.setRotation(v.getRotation2d());
                player.moveRelative(0, 1);

                if (system.currentTick % 20 === 0) {
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

interface TemporaryBlock {
    readonly location: Vector3;

    readonly dimensionId: string;

    seconds: number;
}

function putTemporaryBlock(manager: SimulatedPlayerManager, block: Block) {
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
