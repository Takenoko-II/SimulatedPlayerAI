import { Block, BlockPermutation, ContainerSlot, Entity, EntityComponentTypes, EquipmentSlot, GameMode, ItemComponentTypes, ItemStack, Player, system, world } from "@minecraft/server";
import { Material, MaterialTag } from "./lib/Material";
import { TripleAxisRotationBuilder, Vector3Builder } from "./util/Vector";
import { RandomNumberHandler } from "./util/Random";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";

interface MineCutAllEventListeners {
    readonly onComplete: Set<() => void>;

    readonly onBreakTool: Set<() => void>;
}

type MineCutAllEventTypes = keyof MineCutAllEventListeners;

class MineCutAllHandler {
    private readonly player: Player;

    private readonly selectedSlot: ContainerSlot;

    private readonly entries: MineCutAllEntry[] = [];

    private readonly queues: Set<string> = new Set();

    private readonly __events__: MineCutAllEventListeners = {
        onComplete: new Set(),
        onBreakTool: new Set()
    };

    private constructor(player: Player) {
        this.player = player;
        this.selectedSlot = player.getComponent(EntityComponentTypes.Equippable).getEquipmentSlot(EquipmentSlot.Mainhand);
    }

    private hasFortune(): boolean {
        const itemStack = this.selectedSlot.getItem();

        if (itemStack === undefined) {
            throw new Error("hasFortune");
        }

        return itemStack.getComponent(ItemComponentTypes.Enchantable).hasEnchantment("fortune");
    }

    private hasSilkTouch(): boolean {
        const itemStack = this.selectedSlot.getItem();

        if (itemStack === undefined) {
            throw new Error("hasSilkTouch");
        }

        return itemStack.getComponent(ItemComponentTypes.Enchantable).hasEnchantment("silk_touch");
    }

    private getFortuneScaledDrops(initialCount: number): number {
        const itemStack = this.selectedSlot.getItem();

        if (itemStack === undefined) {
            throw new Error("getFortuneScaledDrops (1)");
        }

        if (!itemStack.hasComponent(ItemComponentTypes.Enchantable)) {
            throw new Error("getFortuneScaledDrops (2)");
        }

        let chanceList: number[];

        switch (itemStack.getComponent(ItemComponentTypes.Enchantable).getEnchantment("fortune")?.level ?? 0) {
            case 1:
                chanceList = [1, 1];
                break;
            case 2:
                chanceList = [2, 1, 1];
                break;
            case 3:
                chanceList = [2, 1, 1, 1];
                break;
        }
    
        return RandomNumberHandler.choiceByWeight(chanceList) + initialCount;
    }

    private tryActivateUnbreaking(): boolean {
        const itemStack = this.selectedSlot.getItem();
        if (itemStack === undefined) return false;
        if (!itemStack.hasComponent(ItemComponentTypes.Durability)) return false;
        if (!itemStack.hasComponent(ItemComponentTypes.Enchantable)) return false;

        const enchantment = itemStack.getComponent(ItemComponentTypes.Enchantable);
        if (!enchantment.hasEnchantment("unbreaking")) return false;

        const level = enchantment.getEnchantment("unbreaking").level;
        const random = Math.random();

        return random > 1 / (level + 1);
    }

    private hasDurability(): boolean {
        const itemStack = this.selectedSlot.getItem();
        if (itemStack === undefined) return false;
        return itemStack.hasComponent(ItemComponentTypes.Durability);
    }

    private applyToolDamage(): boolean {
        if (this.player.getGameMode() === GameMode.creative) return;

        const itemStack = this.selectedSlot.getItem();

        if (itemStack === undefined) {
            throw new Error("applyToolDamage");
        }

        if (this.tryActivateUnbreaking()) return;

        const durability = itemStack.getComponent(ItemComponentTypes.Durability);

        if (durability.maxDurability > durability.damage) {
            durability.damage++;
            this.selectedSlot.setItem(itemStack);
            return false;
        }
        else {
            this.selectedSlot.setItem();
            this.player.playSound("random.break", { volume: 10, pitch: 1 });
            this.__events__.onBreakTool.forEach(listener => listener());
            return true;
        }
    }

    private getBlocks(source: Block, center: Block, filter: string[], limitDistance: number): Block[] {
        return [
            center,
            center.north(),
            center.south(),
            center.east(),
            center.west(),
            center.north().east(),
            center.north().west(),
            center.south().east(),
            center.south().west()
        ]
        .flatMap(block => [block.above(), block, block.below()])
        .filter(block => {
            const distance = Vector3Builder.from(block.location).getDistanceBetween(Vector3Builder.from(source.location));
            return filter.includes(block.typeId)
                && distance < limitDistance;
        });
    }

    private destroyBlock(block: Block): [Entity[], BlockPermutation] {
        const { x, y, z } = block.location;
        const items = block.dimension.getEntities({ type: "minecraft:item" });
        const permutation = block.permutation;
        block.dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
        const dropped = block.dimension.getEntities({ type: "minecraft:item" }).filter(item => !items.includes(item));

        return [dropped, permutation];
    }

    private spread(source: Block, center: Block, entry: MineCutAllEntry): void {
        for (const block of this.getBlocks(source, center, entry.getTargetIds(), entry.distance())) {
            if (!this.selectedItemIsValid()) break;

            const id = RandomNumberHandler.uuid();
            this.queues.add(id);

            const [droppedItemEntities, permutation] = this.destroyBlock(block);

            if (this.hasSilkTouch() && entry.isSilkTouchEnabled()) {
                const itemType = Material.getMaterial(permutation.type.id).getAsItemType();
                block.dimension.spawnItem(new ItemStack(itemType), block.location);
                droppedItemEntities.forEach(item => item.remove());
            }
            else if (this.hasFortune() && entry.isFortuneEnabled()) {
                droppedItemEntities.forEach(item => {
                    const itemStack = item.getComponent("item").itemStack;
                    itemStack.amount = this.getFortuneScaledDrops(itemStack.amount);
                    item.remove();
                    block.dimension.spawnItem(itemStack, block.location);
                });
            }
            else {
                // No Enchantment
            }

            const broken = this.applyToolDamage();

            if (broken) {
                this.queues.delete(id);
                break;
            }

            const delay = Math.floor(Math.random() * 3) + 1;

            system.runTimeout(() => {
                this.spread(source, block, entry);
                this.queues.delete(id);
            }, delay);
        }
    }

    private selectedItemIsValid(): boolean {
        const itemStack = this.selectedSlot.getItem();
        if (itemStack === undefined) {
            return false;
        }

        if (!this.hasDurability()) {
            return false;
        }

        return true;
    }

    private trigger(source: Block, entry: MineCutAllEntry): void {
        if (!this.selectedItemIsValid()) {
            throw new Error("trigger");
        }

        if (this.queues.size > 0) {
            throw new Error("queues count is not 0");
        }

        this.spread(source, source, entry);

        let i = 0;
        const handle = system.runInterval(() => {
            i++;
            if (this.queues.size === 0) {
                this.__events__.onComplete.forEach(listener => listener());
                system.clearRun(handle);
            }
            else if (i > (20 * 8)) {
                system.clearRun(handle);
                console.warn("queue observer is disabled");
            }
        });
    }

    public tryTrigger(brokenBlockPermutation: BlockPermutation, source: Block): void {
        if (!this.selectedItemIsValid()) return;

        for (const entry of this.entries) {
            if (this.player.isSneaking && entry.matches(brokenBlockPermutation.type.id, this.selectedSlot.getItem()?.typeId)) {
                this.trigger(source, entry);
                break;
            }
        }
    }

    public addEntry(...entries: MineCutAllEntry[]): void {
        this.entries.push(...entries);
    }

    public addEventListener(event: MineCutAllEventTypes, listener: () => void): void {
        this.__events__[event].add(listener);
    }

    public static getCurrentMainHand(player: Player) {
        return new this(player);
    }
}

class MineCutAllEntry {
    private readonly triggerIds: Set<string> = new Set();

    private readonly keyIds: Set<string> = new Set();

    private readonly targetIds: Set<string> = new Set();

    private __distance__: number = 5;

    private __isFortuneEnabled__: boolean = false;

    private __isSilkTouchEnabled__: boolean = false;

    private constructor() {}

    private addIdsOf(targetSet: Set<string>, materials: (Material | MaterialTag)[], checker: (material: Material) => boolean, provider: (material: Material) => string) {
        materials.forEach(value => {
            if (value instanceof Material) {
                if (!checker(value)) {
                    throw new TypeError();
                }
    
                targetSet.add(provider(value));
            }
            else if (value instanceof MaterialTag) {
                Material.values().filter(material => material.hasTag(value))
                .forEach(material => {
                    if (!checker(material)) {
                        throw new TypeError();
                    }

                    targetSet.add(provider(material));
                });
            }
        });
    }

    public triggers(...triggers: (Material | MaterialTag)[]): Set<string> | void {
        this.addIdsOf(this.triggerIds, triggers, material => material.isBlock, material => material.getAsBlockType().id);
        this.targets(...triggers);
    }

    public keys(...keys: (Material | MaterialTag)[]): void {
        this.addIdsOf(this.keyIds, keys, material => material.isItem, material => material.getAsItemType().id);
    }

    public targets(...targets: (Material | MaterialTag)[]): void {
        this.addIdsOf(this.targetIds, targets, material => material.isBlock, material => material.getAsBlockType().id);
    }

    public distance(): number;

    public distance(value: number): void;

    public distance(value?: number): number | void {
        if (typeof value === "number" && !Number.isNaN(value)) {
            this.__distance__ = value;
        }
        else if (value === undefined) {
            return this.__distance__;
        }
        else {
            throw new TypeError();
        }
    }

    public fortune(flag: boolean): void {
        this.__isFortuneEnabled__ = flag;
    }

    public silkTouch(flag: boolean): void {
        this.__isSilkTouchEnabled__ = flag;
    }

    public matches(brokenBlockId: string, selectedItemId: string): boolean {
        return this.triggerIds.has(brokenBlockId)
            && this.keyIds.has(selectedItemId);
    }

    public getTargetIds(): string[] {
        return [...this.targetIds];
    }

    public isFortuneEnabled(): boolean {
        return this.__isFortuneEnabled__;
    }

    public isSilkTouchEnabled(): boolean {
        return this.__isSilkTouchEnabled__;
    }

    private static getMineAllOf(pickaxe: Material, blockTag?: MaterialTag) {
        const entry = new MineCutAllEntry();
        entry.triggers(...Material.values().filter(material => (blockTag ? !material.hasTag(blockTag) : true) && material.hasTag(MaterialTag.ORES)));
        entry.keys(pickaxe);
        entry.distance(16);
        entry.fortune(true);
        entry.silkTouch(true);
        return entry;
    }

    public static getMineAll() {
        return [
            this.getMineAllOf(Material.WOODEN_PICKAXE, MaterialTag.BLOCKS_INCORRECT_FOR_WOODEN_TOOLS),
            this.getMineAllOf(Material.STONE_PICKAXE, MaterialTag.BLOCKS_INCORRECT_FOR_STONE_TOOLS),
            this.getMineAllOf(Material.IRON_PICKAXE, MaterialTag.BLOCKS_INCORRECT_FOR_IRON_TOOLS),
            this.getMineAllOf(Material.GOLDEN_PICKAXE, MaterialTag.BLOCKS_INCORRECT_FOR_GOLDEN_TOOLS),
            this.getMineAllOf(Material.DIAMOND_PICKAXE),
            this.getMineAllOf(Material.NETHERITE_PICKAXE)
        ];
    }

    public static getCutAll() {
        const entry = new MineCutAllEntry();
        entry.triggers(MaterialTag.LOGS);
        entry.targets(MaterialTag.LEAVES);
        entry.keys(MaterialTag.AXES);
        entry.distance(16);
        entry.fortune(false);
        entry.silkTouch(false);
        return entry;
    }

    private static getSingleStone(material: Material) {
        const entry = new this();
        entry.triggers(material);
        entry.keys(MaterialTag.PICKAXES);
        entry.fortune(false);
        entry.silkTouch(false);
        return entry;
    }

    public static getUncommonStones() {
        return [
            this.getSingleStone(Material.ANDESITE),
            this.getSingleStone(Material.DIORITE),
            this.getSingleStone(Material.GRANITE)
        ];
    }
}

world.afterEvents.playerBreakBlock.subscribe(({ player, brokenBlockPermutation, block }) => {
    const handler = MineCutAllHandler.getCurrentMainHand(player);
    handler.addEntry(
        MineCutAllEntry.getCutAll(),
        ...MineCutAllEntry.getMineAll(),
        ...MineCutAllEntry.getUncommonStones()
    );

    handler.tryTrigger(brokenBlockPermutation, block);
});

SimulatedPlayerManager.requestSpawnPlayer({
    name: "Steve",
    onCreate(player, time) {
        console.warn(player.getAsServerPlayer().name + " joined. (" + time + "ms)");
        player.ai = true;
    }
});

SimulatedPlayerManager.events.on("onDie", event => {
    system.runTimeout(() => {
        event.simulatedPlayerManager.getAsGameTestPlayer().respawn();
    }, 40);
});

system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id === "simulated_player:manager" && event.sourceEntity instanceof Player) {
        SimulatedPlayerManager.showAsForm(event.sourceEntity);
    }
});