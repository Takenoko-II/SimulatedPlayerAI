import { Player, system, ItemStack, GameMode, world, SystemInfo, InputButton } from "@minecraft/server";
import { SimulatedPlayerManager } from "./simulated_player/SimulatedPlayerManager";
import { Material } from "./lib/Material";
import { SIMULATED_PLAYER_COMMAND_TAG, SIMULATED_PLAYER_DEFAULT_NAME, SimulatedPlayerAIHandlerRegistry, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./simulated_player/enumerations";
import { CombatAIHandler} from "./simulated_player/ai/CombatAIHandler";
import { SimulatedPlayerAIHandler } from "./simulated_player/AI";
import { TemporaryBlockManager } from "./simulated_player/TemporaryBlock";
import { collectPluginStats, collectRuntimeStats } from "@minecraft/debug-utilities";
import { Serializer } from "./util/Serializable";

SimulatedPlayerManager.events.on("onSpawn", event => {
    event.simulatedPlayerManager.repairEquipment();
});

SimulatedPlayerManager.events.on("onBeforeLeave", event => {
    world.sendMessage([
        { text: "§e" },
        {
            translate: "multiplayer.player.left",
            with: [event.simulatedPlayerManager.getAsServerPlayer().name]
        }
    ]);
});

SimulatedPlayerManager.events.on("onDie", async event => {
    await system.waitTicks(60);
    if (!event.simulatedPlayerManager.isValid()) return;
    event.simulatedPlayerManager.getAsGameTestPlayer().respawn();
});

SimulatedPlayerManager.events.on("onInteractedByPlayer", event => {
    if (event.interacter.isSneaking) {
        event.simulatedPlayerManager.openConfigUI(event.interacter);
    }
});

system.afterEvents.scriptEventReceive.subscribe(event => {
    const [namespace, id] = event.id.split(":");

    if (namespace !== "simulated_player") return;

    switch (id) {
        case "manager": {
            if (event.sourceEntity instanceof Player) {
                SimulatedPlayerManager.openManagerUI(event.sourceEntity);
            }
            break;
        }
        case "spawn": {
            SimulatedPlayerManager.requestSpawnPlayer({
                name: event.message.length === 0 ? SIMULATED_PLAYER_DEFAULT_NAME : event.message,
                onCreate(player, timeTakenToSpawn) {
                    player.setAIHandler(CombatAIHandler.ID);
                    player.weapon = SimulatedPlayerWeaponMaterial.WOODEN;
                    player.armor = SimulatedPlayerArmorMaterial.LEATHER;
                    player.canUseEnderPearl = true;
                    player.auxiliary = SimulatedPlayerAuxiliary.TOTEM;
                    player.projectile = new ItemStack(Material.SNOWBALL.getAsItemType(), 16);
                    console.log(timeTakenToSpawn);
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
            if (!/\d+/g.test(event.message)) {
                throw new Error("not an int");
            }

            const x = Number(event.message);

            if (x > 50) throw new Error("too large number");

            SimulatedPlayerManager.getManagers().forEach(manager => manager.getAsGameTestPlayer().disconnect());
            for (let i = 0; i < x; i++) {
                SimulatedPlayerManager.requestSpawnPlayer({
                    name: "Player(" + (i + 1) + ")",
                    onCreate(player, time) {
                        player.setAIHandler(CombatAIHandler.ID);
                        player.weapon = SimulatedPlayerWeaponMaterial.DIAMOND;
                        player.armor = SimulatedPlayerArmorMaterial.DIAMOND;
                        // (player.ai as CombatAIHandler).config.followRange = 40;
                        console.warn(time);
                    }
                });
            }
            break;
        }
        case "blocks": {
            console.log("blocks: " + JSON.stringify(TemporaryBlockManager.getAllBlocks(), undefined, 2));
            break;
        }
        case "eval": {
            eval(event.message);
            break;
        }
        case "info": {
            const serializer = new Serializer();
            serializer.hidePrototypeOf(Object);
            serializer.hidePrototypeOf(Array);
            serializer.unhidePrototypeOf(Function);
            serializer.hidePrototypeOf(SystemInfo);

            console.log("info: " + serializer.serialize({
                runtime: collectRuntimeStats(),
                plugins: collectPluginStats().plugins,
                server: system.serverSystemInfo,
                clients: world.getPlayers({ excludeTags: [SIMULATED_PLAYER_COMMAND_TAG] }).map(player => ({ id: player.id, name: player.name, ...player.clientSystemInfo })),
                simulations: [...SimulatedPlayerManager.getManagers()].map(player => ({ id: player.getAsServerPlayer().id, name: player.getAsServerPlayer().name, isValid: player.isValid() }))
            }));
            break;
        }
    }
});

class TestAIHandler extends SimulatedPlayerAIHandler {
    private constructor(m: SimulatedPlayerManager) {
        super(m);
    }

    public tick(): void {
        if (system.currentTick % 2 === 0) {
            this.manager.getAsGameTestPlayer().stopMoving();
            this.manager.getAsGameTestPlayer().isSprinting = false;
            this.manager.getAsGameTestPlayer().isSneaking = !this.manager.getAsGameTestPlayer().isSneaking;
        }
    }

    public static get(manager: SimulatedPlayerManager): TestAIHandler {
        return SimulatedPlayerAIHandler.__getOrCreateHandler__(manager, TestAIHandler.ID, manager => new TestAIHandler(manager));
    }

    public static readonly ID: string = "TEST";
}

SimulatedPlayerAIHandlerRegistry.register(TestAIHandler);

await system.waitTicks(1);

console.log("End of 'Early Execution'");

// Steveを召喚
system.sendScriptEvent("simulated_player:spawn", SIMULATED_PLAYER_DEFAULT_NAME);
