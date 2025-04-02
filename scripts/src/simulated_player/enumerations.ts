import { MinecraftEntityTypes } from "../lib/@minecraft/vanilla-data/lib/index";
import { SimulatedPlayerAIHandler } from "./AI";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";

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

interface AIHandlerClassObject extends Function {
    get(manager: SimulatedPlayerManager): SimulatedPlayerAIHandler;

    readonly ID: string;

    prototype: SimulatedPlayerAIHandler;
}

export class SimulatedPlayerAIHandlerRegistry {
    private constructor() {}

    private static readonly registry: Map<string, AIHandlerClassObject> = new Map();

    public static getAllHandlerIds(): string[] {
        return [...this.registry.keys()];
    }

    public static getIdByHandler(handler: SimulatedPlayerAIHandler): string {
        for (const clazz of this.registry.values()) {
            if (handler instanceof clazz) {
                return clazz.ID;
            }
        }

        throw new Error("NEVER HAPPENS?");
    }

    public static getHandlerById(id: string, manager: SimulatedPlayerManager): SimulatedPlayerAIHandler {
        if (this.registry.has(id)) {
            return this.registry.get(id)!.get(manager);
        }
        else {
            throw new Error("無効なIDです");
        }
    }

    public static register(clazz: AIHandlerClassObject) {
        if (this.registry.has(clazz.ID)) {
            throw new Error("既に登録済みのIDです");
        }
        else {
            this.registry.set(clazz.ID, clazz);
        }
    }
}

export const SIMULATED_PLAYER_ENEMIES: string[] = [
    MinecraftEntityTypes.FishingHook,
    MinecraftEntityTypes.Arrow,
    MinecraftEntityTypes.ThrownTrident,
    MinecraftEntityTypes.Snowball,
    MinecraftEntityTypes.Egg,
    MinecraftEntityTypes.EnderPearl,
    MinecraftEntityTypes.XpBottle,
    MinecraftEntityTypes.SplashPotion,
    MinecraftEntityTypes.LingeringPotion,
    MinecraftEntityTypes.Fireball,
    MinecraftEntityTypes.SmallFireball,
    MinecraftEntityTypes.DragonFireball,
    MinecraftEntityTypes.WitherSkull,
    MinecraftEntityTypes.WitherSkullDangerous,
    MinecraftEntityTypes.ShulkerBullet,
    MinecraftEntityTypes.FireworksRocket,
    MinecraftEntityTypes.LlamaSpit,
    MinecraftEntityTypes.WindChargeProjectile,
    MinecraftEntityTypes.EyeOfEnderSignal,
    MinecraftEntityTypes.Minecart,
    MinecraftEntityTypes.ChestMinecart,
    MinecraftEntityTypes.HopperMinecart,
    MinecraftEntityTypes.TntMinecart,
    MinecraftEntityTypes.CommandBlockMinecart,
    MinecraftEntityTypes.Boat,
    MinecraftEntityTypes.ChestBoat,
    MinecraftEntityTypes.AreaEffectCloud,
    MinecraftEntityTypes.Tnt,
    "minecraft:falling_block",
    "minecraft:item",
    MinecraftEntityTypes.XpOrb,
    MinecraftEntityTypes.EnderCrystal,
    MinecraftEntityTypes.LightningBolt,
    "minecraft:evocation_fang",
    "minecraft:leash_knot",
    "minecraft:painting",
    MinecraftEntityTypes.Agent,
    MinecraftEntityTypes.ArmorStand,
    MinecraftEntityTypes.Npc
];

export const SIMULATED_PLAYER_COMMAND_TAG: string = "simulated_player:identifier";

export const SIMULATED_PLAYER_BASE_SPEED: number = 0.65;

export const SIMULATED_PLAYER_DEFAULT_NAME = "Steve";
