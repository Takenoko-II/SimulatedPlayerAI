import { Player, system, ItemStack, GameMode, world } from "@minecraft/server";
import { SimulatedPlayerManager } from "./simulated_player/SimulatedPlayerManager";
import { Material } from "./lib/Material";
import { SIMULATED_PLAYER_DEFAULT_NAME, SimulatedPlayerAI, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./simulated_player/enumerations";
import { MinecraftDimensionTypes } from "./lib/@minecraft/vanilla-data/lib/index";

SimulatedPlayerManager.events.on("onDie", async event => {
    await system.waitTicks(60);
    if (!event.simulatedPlayerManager.isValid()) return;
    event.simulatedPlayerManager.getAsGameTestPlayer().respawn();
});

SimulatedPlayerManager.events.on("onInteractedByPlayer", event => {
    if (event.interacter.isSneaking) {
        event.simulatedPlayerManager.openConfigForm(event.interacter);
    }
});

system.afterEvents.scriptEventReceive.subscribe(event => {
    const [namespace, id] = event.id.split(":");

    if (namespace !== "simulated_player") return;

    switch (id) {
        case "manager": {
            if (event.sourceEntity instanceof Player) {
                SimulatedPlayerManager.openManagerForm(event.sourceEntity);
            }
            break;
        }
        case "spawn": {
            SimulatedPlayerManager.requestSpawnPlayer({
                name: event.message.length === 0 ? SIMULATED_PLAYER_DEFAULT_NAME : event.message,
                onCreate(player) {
                    player.ai = SimulatedPlayerAI.COMBAT;
                    player.weapon = SimulatedPlayerWeaponMaterial.WOODEN;
                    player.armor = SimulatedPlayerArmorMaterial.LEATHER;
                    player.canUseEnderPearl = true;
                    player.auxiliary = SimulatedPlayerAuxiliary.TOTEM;
                    player.projectile = new ItemStack(Material.SNOWBALL.getAsItemType(), 16);
                }
            });
            break;
        }
        case "delete_all": {
            SimulatedPlayerManager.getManagers().forEach(manager => {
                manager.getAsGameTestPlayer().disconnect();
            });
            break;
        }
        case "chaos": {
            SimulatedPlayerManager.getManagers().forEach(manager => manager.getAsGameTestPlayer().disconnect());
            for (let i = 0; i < 8; i++) {
                SimulatedPlayerManager.requestSpawnPlayer({
                    name: "Player(" + (i + 1) + ")",
                    onCreate(player, time) {
                        player.ai = SimulatedPlayerAI.COMBAT;
                        player.weapon = SimulatedPlayerWeaponMaterial.DIAMOND;
                        player.armor = SimulatedPlayerArmorMaterial.DIAMOND;
                        console.warn(time);
                    }
                });
            }
            break;
        }
        case "test": {
            SimulatedPlayerManager.getManagers().forEach(manager => {
                manager.behaviorState.preparingForAttack = false;
            });
            break;
        }
    }
});

SimulatedPlayerManager.commonConfig.followRange = 40;

await system.waitTicks(1);

console.log("'Early Execution' has been ended.");

system.sendScriptEvent("simulated_player:spawn", SIMULATED_PLAYER_DEFAULT_NAME);
