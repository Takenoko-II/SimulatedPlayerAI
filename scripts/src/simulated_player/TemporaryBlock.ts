import { Block, BlockPistonState, LocationOutOfWorldBoundariesError, system, UnloadedChunksError, Vector3, world } from "@minecraft/server";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";
import { Material } from "../lib/Material";
import { Vector3Builder } from "../util/Vector";

export interface TemporaryBlockPlacementConfig {
    material: Material;

    lifespanSeconds: number;
}

interface TemporaryBlock {
    readonly location: Vector3;

    readonly dimensionId: string;

    readonly blockId: string;

    seconds: number;
}

console.log("TEMPORARY");

system.runInterval(() => {
    const blocks = TemporaryBlockManager.getAllBlocks();
    for (const info of blocks) {
        try {
            const block = world.getDimension(info.dimensionId).getBlock(info.location);

            if (block === undefined) {
                continue;
            }

            if (info.seconds > 0) {
                TemporaryBlockManager.advanceClock(block, 1);
            }
            else {
                TemporaryBlockManager.tryDestroy(block);
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
}, 20);

export class TemporaryBlockManager {
    private constructor() {}

    public static readonly DYNAMIC_PROPERTY_ID: string = "simulated_player:temporary_blocks";

    public static getAllBlocks(): TemporaryBlock[] {
        return JSON.parse((world.getDynamicProperty(this.DYNAMIC_PROPERTY_ID) ?? "[]") as string);
    }

    public static isTemporaryBlock(block: Block): boolean {
        return this.getAllBlocks().some(({ dimensionId, location }) => dimensionId === block.dimension.id && Vector3Builder.from(location).equals(block.location));
    }

    public static advanceClock(block: Block, seconds: number): void {
        const tBlocks = this.getAllBlocks();
        
        for (const tBlock of tBlocks) {
            if (tBlock.dimensionId === block.dimension.id && Vector3Builder.from(tBlock.location).equals(tBlock.location)) {
                tBlock.seconds -= seconds;
                break;
            }
        }

        world.setDynamicProperty(this.DYNAMIC_PROPERTY_ID, JSON.stringify(tBlocks));
    }

    public static tryDestroy(block: Block): void {
        const temporaryBlocks = this.getAllBlocks();
        const temporaryBlock = temporaryBlocks.find(({ dimensionId, location }) => dimensionId === block.dimension.id && Vector3Builder.from(location).equals(block.location));

        if (temporaryBlock === undefined) {
            return;
        }

        if (temporaryBlock.blockId === block.type.id) {
            const { x, y, z } = block.location;
            const items = block.dimension.getEntities({ type: "minecraft:item" });
            block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
            const droppedItems = block.dimension.getEntities({ type: "minecraft:item" }).filter(entity => !items.some(item => item.id === entity.id));
            droppedItems.forEach(item => item.remove());
        }

        temporaryBlocks.splice(temporaryBlocks.indexOf(temporaryBlock), 1);
        world.setDynamicProperty(this.DYNAMIC_PROPERTY_ID, JSON.stringify(temporaryBlocks));
    }

    public static tryPlace(block: Block, config: TemporaryBlockPlacementConfig) {
        if (!block.isValid || !config.material.isBlock) {
            throw new TypeError();
        }

        if (!block.isAir && !block.isLiquid) return;

        block.setType(config.material.getAsBlockType());

        const temporaryBlocks: TemporaryBlock[] = this.getAllBlocks();

        temporaryBlocks.push({
            dimensionId: block.dimension.id,
            location: block.location,
            seconds: config.lifespanSeconds,
            blockId: config.material.getAsBlockType().id
        });

        world.setDynamicProperty(this.DYNAMIC_PROPERTY_ID, JSON.stringify(temporaryBlocks));
    }
}

world.beforeEvents.explosion.subscribe(event => {
    const blocks = new Set(event.getImpactedBlocks());

    for (const block of blocks) {
        if (TemporaryBlockManager.isTemporaryBlock(block)) {
            blocks.delete(block);
            TemporaryBlockManager.tryDestroy(block);
            break;
        }
    }

    event.setImpactedBlocks([...blocks]);
});

world.beforeEvents.playerBreakBlock.subscribe(async event => {
    if (TemporaryBlockManager.isTemporaryBlock(event.block)) {
        event.cancel = true;
        await Promise.resolve();
        TemporaryBlockManager.tryDestroy(event.block);
    }
});
