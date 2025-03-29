import { system } from "@minecraft/server";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";

export abstract class SimulatedPlayerAIHandler {
    protected constructor(protected readonly manager: SimulatedPlayerManager) {}

    public abstract tick(): void;

    protected static readonly instanceMap: Map<SimulatedPlayerManager, Map<string, SimulatedPlayerAIHandler>> = new Map();

    protected static __getOrCreateHandler__(manager: SimulatedPlayerManager, id: string, constructor: (manager: SimulatedPlayerManager) => SimulatedPlayerAIHandler): SimulatedPlayerAIHandler {
        if (this.instanceMap.has(manager)) {
            // そのmanagerについて既になにかしらのhandlerインスタンスは生成されているとき
            const map: Map<string, SimulatedPlayerAIHandler> = this.instanceMap.get(manager)!;
            if (map.has(id)) {
                // この種類のインスタンスが生成されていれば
                return map.get(id)!;
            }
            else {
                // 生成されていなければ
                const i = constructor(manager);
                map.set(id, i);
                this.instanceMap.set(manager, map); // これいらんくね？
                return i;
            }
        }
        else {
            // そのmanagerについて初のなにかしらのhandlerインスタンス生成のとき
            const i = constructor(manager);
            this.instanceMap.set(manager, new Map([[id, i]]));
            return i;
        }
    }
}

system.runInterval(() => {
    for (const manager of SimulatedPlayerManager.getManagers()) {
        manager.getAIHandler().tick();
    }
});
