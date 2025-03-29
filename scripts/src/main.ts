import { Player, system, ItemStack } from "@minecraft/server";
import { SimulatedPlayerManager } from "./simulated_player/SimulatedPlayerManager";
import { Material } from "./lib/Material";
import { SIMULATED_PLAYER_DEFAULT_NAME, SimulatedPlayerAIHandlerRegistry, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./simulated_player/enumerations";
import { MinecraftDimensionTypes } from "./lib/@minecraft/vanilla-data/lib/index";
import { CombatAIHandler} from "./simulated_player/ai/CombatAIHandler";
import { SimulatedPlayerAIHandler } from "./simulated_player/AI";

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
                    player.setAIById(CombatAIHandler.ID);
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
                        player.setAIById(CombatAIHandler.ID);
                        player.weapon = SimulatedPlayerWeaponMaterial.DIAMOND;
                        player.armor = SimulatedPlayerArmorMaterial.DIAMOND;
                        // (player.ai as CombatAIHandler).config.followRange = 40;
                        console.warn(time);
                    }
                });
            }
            break;
        }
    }
});

await system.waitTicks(1);

console.log("'Early Execution' has been ended.");

system.sendScriptEvent("simulated_player:spawn", SIMULATED_PLAYER_DEFAULT_NAME);

SimulatedPlayerManager.requestSpawnPlayer({
    name: "Foo",
    onCreate(manager) {
        manager.setAIById(CombatAIHandler.ID);
        (manager.getAIHandler() as CombatAIHandler).config.block.material = Material.DIAMOND_BLOCK;
    }
})

class TestAIHandler extends SimulatedPlayerAIHandler {
    private constructor(m: SimulatedPlayerManager) {
        super(m);
    }

    public tick(): void {
        if (system.currentTick % 20 === 0) this.manager.getAsGameTestPlayer().jump();
    }

    public static getOrCreateHandler(manager: SimulatedPlayerManager): TestAIHandler {
        return SimulatedPlayerAIHandler.__getOrCreateHandler__(manager, TestAIHandler.ID, manager => new TestAIHandler(manager));
    }

    public static readonly ID: string = "TEST";
}

SimulatedPlayerAIHandlerRegistry.register(TestAIHandler);
