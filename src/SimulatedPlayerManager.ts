import { BlockVolume, EntityComponentTypes, EntityDamageSource, EntityQueryOptions, EquipmentSlot, GameMode, ItemStack, Player, system, Vector3, world } from "@minecraft/server";

import { register, SimulatedPlayer } from "@minecraft/server-gametest";

import { MinecraftDimensionTypes } from "./lib/@minecraft/vanilla-data/lib/index";

import { ActionFormWrapper, MessageFormWrapper, ModalFormWrapper } from "./lib/UI";
import { TripleAxisRotationBuilder, Vector3Builder } from "./util/Vector";
import { Material } from "./lib/Material";

export interface SimulatedPlayerSpawnRequest {
    readonly name: string;

    readonly spawnPoint?: Vector3;

    readonly gameMode?: GameMode;

    onCreate(manager: SimulatedPlayerManager, requiredTimeToSpawn: number): void;
}

interface SimulatedPlayerSpawnRequestInternalInfo extends SimulatedPlayerSpawnRequest {
    readonly requestTime: number;
}

const nextSpawnRequestQueue: SimulatedPlayerSpawnRequestInternalInfo[] = [];

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

    player.teleport(request.spawnPoint ?? { x: 0.5, y: -60, z: 0.5 });
    request.onCreate(new SimulatedPlayerManager(player), Date.now() - request.requestTime);
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

type SimulatedPlayerEventTypes = {
    readonly onHealthChange: SimulatedPlayerHealthChangeEvent;

    readonly onDie: SimulatedPlayerDieEvent;

    readonly onSpawn: SimulatedPlayerSpawnEvent;

    readonly onHurt: SimulatedPlayerHurtEvent;
}

enum SimulatedPlayerArmorMaterial {
    NONE = "none",
    LEATHER = "leather",
    GOLDEN = "golden",
    CHAINMAIL = "chainmail",
    IRON = "iron",
    DIAMOND = "diamond",
    NETHERITE = "netherite"
}

enum SimulatedPlayerWeaponMaterial {
    NONE = "none",
    WOODEN = "wooden",
    GOLDEN = "golden",
    STONE = "stone",
    IRON = "iron",
    DIAMOND = "diamond",
    NETHERITE = "netherite"
}

export class SimulatedPlayerManager {
    private readonly player: SimulatedPlayer;

    private __armor__: SimulatedPlayerArmorMaterial = SimulatedPlayerArmorMaterial.NONE;

    private __weapon__: SimulatedPlayerWeaponMaterial = SimulatedPlayerWeaponMaterial.NONE;

    private __ai__: boolean = true;

    public get ai(): boolean {
        return this.__ai__;
    }

    public set ai(flag) {
        this.__ai__ = flag;
    }

    public constructor(player: SimulatedPlayer) {
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

    public isValid(): boolean {
        return this.player.isValid() && this.getAsServerPlayer().isValid();
    }

    public static requestSpawnPlayer(request: SimulatedPlayerSpawnRequest): void {
        nextSpawnRequestQueue.push({ requestTime: Date.now(), ...request });
        world.getDimension(MinecraftDimensionTypes.Overworld).runCommand("execute positioned 0.0 0.0 100000.0 run gametest run simulated_player:spawn");
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
        on: (event, listener) => {
            return SimulatedPlayerEventHandlerRegistry.get(event).add(listener);
        },
        off: (id) => {
            SimulatedPlayerEventHandlerRegistry.remove(id);
        }
    };

    public static showAsForm(player: Player) {
        form.main().open(player);
    }
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
                    event.player.sendMessage("召喚に成功しました");
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
        const form = new ActionFormWrapper();
        form.title("List of Simulated Player");
        for (const player of SimulatedPlayerManager.getManagers()) {
            form.button("§6" + player.getAsGameTestPlayer().name, ["player", player.getAsGameTestPlayer().id]);
        }
        form.onPush(button => button.tags.includes("player"), event => {
            const manager = SimulatedPlayerManager.getById(event.button.tags[1]);
            if (manager === undefined) return;
            callback(manager);
        });
        return form;
    },

    config(manager: SimulatedPlayerManager): ModalFormWrapper {
        const armors = ["none", "leather", "golden", "chainmail", "iron", "diamond", "netherite"];
        const weapons = ["none", "wooden", "stone", "iron", "diamond", "netherite"];
        return new ModalFormWrapper()
        .title("Simulated Player Config")
        .dropdown("armor", "防具", armors, armors.indexOf(manager.armor))
        .dropdown("weapon", "近接武器", weapons, weapons.indexOf(manager.weapon))
        .dropdown("offHand", "オフハンド", ["none", "shield", "totem_of_undying"])
        .toggle("ai", "AI", manager.ai)
        .onSubmit(event => {
            const offHand = event.getDropdown("offHand");
            const equippable = manager.getAsServerPlayer().getComponent(EntityComponentTypes.Equippable);

            manager.ai = event.getToggle("ai");
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
}

world.afterEvents.entityHealthChanged.subscribe(event => {
    const manager = SimulatedPlayerManager.getById(event.entity.id);

    if (manager === undefined) return;
    if (!manager.isValid()) return;

    manager.getAsGameTestPlayer().nameTag = `${manager.getAsGameTestPlayer().name}\n§r§cHealth: §f${event.newValue < 0 ? 0 : event.newValue}`;

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

    manager.getAsGameTestPlayer().teleport({ x: 0.5, y: -60, z: 0.5 });
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

const handledMap: Map<SimulatedPlayerManager, boolean> = new Map();
const simulatedPlayerFallingTicks: Map<SimulatedPlayerManager, number> = new Map();

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

        const entities = player.dimension.getEntities({ location: location, maxDistance: 20, excludeTypes })
        .filter(entity => {
            if (entity.id === player.id) return false;

            if (entity instanceof Player) {
                return entity.getGameMode() !== GameMode.creative;
            }

            return true;
        });

        const target = entities[0];

        const distance = target ? Vector3Builder.from(location).getDistanceBetween(target.location) : 0;

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
            if ((simulatedPlayerFallingTicks.get(playerManager) ?? 0) > 1) {
                player.attackEntity(target);
            }
        }
        else if (entities.length > 0 && distance > 3 && distance < 9) {
            player.useItem(new ItemStack("snowball", 1));
        }

        const dir = Vector3Builder.from(player.getViewDirection());
        dir.y = 0;
        dir.scale(0.5);

        const forward = Vector3Builder.from(player.location)
        .add({ x: 0, y: 1, z: 0 })
        .add(dir);

        const dim = playerManager.getAsServerPlayer().dimension;

        const blocks = [
            dim.getBlock(forward),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(0.5))),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(-0.5)))
        ];

        if (blocks.some(block => block.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            player.jump();
            player.applyKnockback(player.getViewDirection().x, player.getViewDirection().z, 0.6, player.getVelocity().y);
        }

        if (entities.length > 0 && distance < 3) {
            const direction = Vector3Builder.from(location).getDirectionTo(target.location);
            const localAxisProvider = direction.getRotation2d().getLocalAxisProvider();
            const knockback = localAxisProvider.getX().add(localAxisProvider.getZ().scale(0.1));

            if (player.isOnGround) {
                player.applyKnockback(knockback.x, knockback.z, 0.6, player.getVelocity().y);
                player.isSneaking = true;
            }
        }
        else if (entities.length > 0) {
            // near
            function placeBlockAndJump() {
                const block = playerManager.getAsServerPlayer().dimension.getBlock(location);
                player.jump();
                system.runTimeout(() => {
                    if (!player.isValid()) return;

                    player.stopMoving();
                    player.isSprinting = false;
                    block.setType(Material.COBBLESTONE.getAsBlockType());
                    system.runTimeout(() => {
                        block.setType(Material.AIR.getAsBlockType());
                    }, 40);
                }, 6);
            }

            function placeBlockAsPath() {
                const block = playerManager.getAsServerPlayer().dimension.getBlock(location).below();
                if (!block.isSolid && !block.below().isSolid && player.isOnGround) {
                    block.setType(Material.COBBLESTONE.getAsBlockType());
                    system.runTimeout(() => {
                        block.setType(Material.AIR.getAsBlockType());
                    }, 40);
                }
            }

            if (target.location.y - location.y > 2) {
                player.stopMoving();
                if (system.currentTick % 10 === 0) placeBlockAndJump();
            }
            else {
                if (Math.abs(target.location.y - location.y) <= 2) {
                    placeBlockAsPath();
                }

                const v = Vector3Builder.from(location).getDirectionTo(target.location);
                player.setRotation(v.getRotation2d());
                player.moveRelative(0, 1);

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
