import { system } from "@minecraft/server";
import { SimulatedPlayerAIHandler } from "../AI";
import { SimulatedPlayerManager } from "../SimulatedPlayerManager";
import { SimulatedPlayerAIHandlerRegistry } from "../enumerations";

export class NoneAIHandler extends SimulatedPlayerAIHandler {
    public tick(): void {
        if (system.currentTick % 30 === 0) {
            this.manager.getAsGameTestPlayer().stopMoving();
            this.manager.getAsGameTestPlayer().isSprinting = false;
        }
    }

    public static get(manager: SimulatedPlayerManager): NoneAIHandler {
        const constructor = (manager: SimulatedPlayerManager) => new NoneAIHandler(manager);
        return SimulatedPlayerAIHandler.__getOrCreateHandler__(manager, NoneAIHandler.ID, constructor);
    }

    public static readonly ID: string = "NONE";
}

SimulatedPlayerAIHandlerRegistry.register(NoneAIHandler);
