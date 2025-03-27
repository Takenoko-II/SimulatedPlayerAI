import { Block, LocationOutOfWorldBoundariesError, system, UnloadedChunksError, Vector3, world } from "@minecraft/server";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";
import { Material } from "../lib/Material";

export interface TemporaryBlockPlacementConfig {
    material: Material;

    lifespanSeconds: number;
}

interface TemporaryBlock {
    readonly location: Vector3;

    readonly dimensionId: string;

    seconds: number;
}

system.runInterval(() => {
    const temporaryBlocks: TemporaryBlock[] = JSON.parse((world.getDynamicProperty("simulated_player:temporary_blocks") ?? "[]") as string);

    for (const info of temporaryBlocks) {
        try {
            const block = world.getDimension(info.dimensionId).getBlock(info.location);

            if (block === undefined) {
                continue;
            }

            if (block.permutation.type.id === SimulatedPlayerManager.commonConfig.block.material.getAsBlockType().id) {
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

export class TemporaryBlockManager {
    private constructor() {}

    public static tryPlace(block: Block, material: Material) {
        if (!block.isValid || !material.isBlock) {
            throw new TypeError();
        }

        if (!block.isAir && !block.isLiquid) return;

        block.setType(material.getAsBlockType());
    
        const temporaryBlocks: TemporaryBlock[] = JSON.parse((world.getDynamicProperty("simulated_player:temporary_blocks") ?? "[]") as string);
    
        temporaryBlocks.push({
            dimensionId: block.dimension.id,
            location: block.location,
            seconds: SimulatedPlayerManager.commonConfig.block.lifespanSeconds
        });
    
        world.setDynamicProperty("simulated_player:temporary_blocks", JSON.stringify(temporaryBlocks));
    }
}
