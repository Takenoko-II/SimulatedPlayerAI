import { Block, BlockPistonState, LocationOutOfWorldBoundariesError, system, UnloadedChunksError, Vector3, world } from "@minecraft/server";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";
import { Material } from "../lib/Material";
import { Vector3Builder } from "../util/Vector";

export interface TemporaryBlockPlacementConfig {
    material: Material;

    lifespanSeconds: number;
}

interface TemporaryBlock {
    readonly pos: Vector3;

    readonly dim: string;

    readonly type: string;

    sec: number;
}

system.runInterval(() => {
    TemporaryBlockManager.advanceClock(1);
}, 20);

export class TemporaryBlockManager {
    private constructor() {}

    public static readonly DYNAMIC_PROPERTY_ID: string = "simulated_player:temporary_blocks";

    public static getAllBlocks(): TemporaryBlock[] {
        return JSON.parse((world.getDynamicProperty(this.DYNAMIC_PROPERTY_ID) ?? "[]") as string);
    }

    public static isTemporaryBlock(block: Block): boolean {
        return this.getAllBlocks().some(({ dim: dimensionId, pos: location }) => dimensionId === block.dimension.id && Vector3Builder.from(location).equals(block.location));
    }

    public static advanceClock(seconds: number): void {
        const tBlocks = this.getAllBlocks();

        const destroyed: Block[] = [];

        for (const tBlock of tBlocks) {
            const block = world.getDimension(tBlock.dim).getBlock(tBlock.pos);
            if (block?.isValid) {
                tBlock.sec -= seconds;
                if (tBlock.sec <= 0) {
                    destroyed.push(block);
                }
            }
        }

        world.setDynamicProperty(this.DYNAMIC_PROPERTY_ID, JSON.stringify(tBlocks));

        for (const d of destroyed) {
            this.tryDestroy(d);
        }
    }

    public static tryDestroy(block: Block): void {
        const temporaryBlocks = this.getAllBlocks();
        const temporaryBlock = temporaryBlocks.find(({ dim: dimensionId, pos: location }) => dimensionId === block.dimension.id && Vector3Builder.from(location).equals(block.location));

        if (temporaryBlock === undefined) {
            return;
        }

        if (temporaryBlock.type === block.type.id) {
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
        if (!block.isValid) {
            throw new Error("読み込まれていないためブロックにアクセスできません");
        }
        else if (!config.material.isBlock) {
            throw new TypeError("マテリアルがブロックではありません");
        }

        if (!block.isAir && !block.isLiquid) return;

        const temporaryBlocks: TemporaryBlock[] = this.getAllBlocks();

        temporaryBlocks.push({
            dim: block.dimension.id,
            pos: block.location,
            sec: config.lifespanSeconds,
            type: config.material.getAsBlockType().id
        });

        const string = JSON.stringify(temporaryBlocks);

        if (string.length > 32767) {
            throw new Error("Cannot place a new temporary block: Maximum size of dynamic property exceeded");
        }

        world.setDynamicProperty(this.DYNAMIC_PROPERTY_ID, string);

        block.setType(config.material.getAsBlockType());
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
