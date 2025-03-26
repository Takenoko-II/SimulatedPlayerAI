import { world, Player, system, ItemStack } from "@minecraft/server";
import { RandomHandler } from "./util/Random";
import { SimulatedPlayerAI, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerManager, SimulatedPlayerSpawnRequest, SimulatedPlayerWeaponMaterial } from "./SimulatedPlayerManager";
import { Material } from "./lib/Material";

SimulatedPlayerManager.events.on("onDie", event => {
    system.runTimeout(() => {
        if (!event.simulatedPlayerManager.isValid()) return;
        event.simulatedPlayerManager.getAsGameTestPlayer().respawn();
    }, 40);
});

system.afterEvents.scriptEventReceive.subscribe(event => {
    const [namespace, id] = event.id.split(":");

    if (namespace !== "simulated_player") return;

    switch (id) {
        case "manager": {
            if (event.sourceEntity instanceof Player) {
                SimulatedPlayerManager.showAsForm(event.sourceEntity);
            }
            break;
        }
        case "spawn": {
            SimulatedPlayerManager.requestSpawnPlayer({
                name: event.message,
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
                    name: RandomHandler.uuid(),
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
    }
});

SimulatedPlayerManager.commonConfig.followRange = 40;

await system.waitTicks(1);

console.log("END: Early Execution");
