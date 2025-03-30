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

export const ENEMIES_FOR_SIMULATED_PLAYER: string[] = [
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
    "wind_charge_projectile",
    // "armor_stand"
];

export const SIMULATED_PLAYER_COMMAND_TAG: string = "simulated_player:identifier";

export const SIMULATED_PLAYER_BASE_SPEED: number = 0.65;

export const SIMULATED_PLAYER_DEFAULT_NAME = "Steve";
