import { Entity, GameMode, ItemStack, Player, system } from "@minecraft/server";
import { SimulatedPlayerManager } from ".././SimulatedPlayerManager";
import { Material } from "../../lib/Material";
import { Vector3Builder } from "../../util/Vector";
import { ENEMIES_FOR_SIMULATED_PLAYER, SIMULATED_PLAYER_BASE_SPEED, SimulatedPlayerAIHandlerRegistry, SimulatedPlayerArmorMaterial } from ".././enumerations";
import { RandomHandler } from "../../util/Random";
import { TemporaryBlockPlacementConfig } from ".././TemporaryBlock";
import { sentry } from "../../lib/TypeSentry";
import { SimulatedPlayerAIHandler } from "../AI";

type DirectionLeftRight = "LEFT" | "RIGHT";

interface CombatAIBehaviorState {
    fallingTicks: number;

    directionToMoveAround: DirectionLeftRight;

    preparingForAttack: boolean;

    distanceError: number;
}

interface CombatAIConfig {
    /**
     * プレイヤーの球形索敵範囲の半径
     */
    followRange: number;

    /**
     * プレイヤーが設置するブロック
     */
    readonly block: TemporaryBlockPlacementConfig;
}

export class CombatAIHandler extends SimulatedPlayerAIHandler {
    private readonly behaviorState: CombatAIBehaviorState = {
        fallingTicks: 0,
        directionToMoveAround: RandomHandler.choice(["LEFT", "RIGHT"]),
        preparingForAttack: false,
        distanceError: RandomHandler.choice([-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
    };

    private readonly __config__: CombatAIConfig = {
        followRange: 40,
        block: {
            lifespanSeconds: 3,
            material: Material.COBBLESTONE
        }
    };

    public readonly config: CombatAIConfig = {
        followRange: undefined as unknown as number,
        block: {
            lifespanSeconds: undefined as unknown as number,
            material: undefined as unknown as Material
        }
    }

    protected constructor(manager: SimulatedPlayerManager) {
        super(manager);
        const that = this;

        Object.defineProperties(this.config.block, {
            lifespanSeconds: {
                get() {
                    return that.__config__.block.lifespanSeconds;
                },
                set(value) {
                    if (sentry.int.nonNaN().test(value)) {
                        that.__config__.block.lifespanSeconds = value;
                    }
                    else {
                        throw new TypeError();
                    }
                }
            },
            material: {
                get() {
                    return that.__config__.block.material;
                },
                set(value: Material) {
                    if (!value.isBlock) throw new TypeError();
                    that.__config__.block.material = value;
                }
            }
        });

        Object.defineProperty(this.config, "followRange", {
            get() {
                return that.__config__.followRange;
            },
            set(value) {
                if (sentry.number.nonNaN().test(value)) {
                    that.__config__.followRange = value;
                }
                else {
                    throw new TypeError();
                }
            }
        });
    }

    private updateFallingTicks() {
        if (this.manager.getAsGameTestPlayer().isFalling) {
            this.behaviorState.fallingTicks++;
        }
        else {
            this.behaviorState.fallingTicks = 0;
        }
    }

    private tryAttack(target: Entity) {
        const serverPlayer = this.manager.getAsServerPlayer();
        const direction = Vector3Builder.from(serverPlayer.location).getDirectionTo(target.location);
        const dist = Vector3Builder.from(serverPlayer.location).getDistanceTo(target.location);
        const rayCastResultFeet = serverPlayer.dimension.getBlockFromRay(serverPlayer.location, direction, { maxDistance: dist + 1 });
        const rayCastResultEyes = serverPlayer.dimension.getBlockFromRay(serverPlayer.getHeadLocation(), direction, { maxDistance: dist + 1 });

        if (this.behaviorState.fallingTicks > 1 && (rayCastResultEyes === undefined || rayCastResultFeet === undefined)) {
            serverPlayer.selectedSlotIndex = 0;
            const r = this.manager.getAsGameTestPlayer().attackEntity(target);
            if (r) {
                this.behaviorState.directionToMoveAround = RandomHandler.choice(["LEFT", "RIGHT"]);
                this.behaviorState.distanceError = RandomHandler.choice([-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6, 0.8, 1.0]);
            }
        }
    }

    public tick(): void {
        this.updateFallingTicks();

        if (this.manager.isDead()) return;

        const location = this.manager.getAsServerPlayer().location;

        const player = this.manager.getAsGameTestPlayer();

        const entities = player.dimension.getEntities({ location: location, maxDistance: this.config.followRange, excludeTypes: ENEMIES_FOR_SIMULATED_PLAYER })
        .filter(entity => {
            if (entity.id === player.id) return false;

            if (entity instanceof Player) {
                return entity.getGameMode() !== GameMode.creative;
            }

            return true;
        });

        const target = entities[0];

        const distance = target ? Vector3Builder.from(location).getDistanceTo(target.location) : 0;

        if (player.isSneaking && !this.behaviorState.preparingForAttack) {
            this.behaviorState.preparingForAttack = true;
            system.runTimeout(() => {
                if (!player.isValid) return;
                // ジャンプしてスニークしてhandled = false;
                player.jump();
                player.isSneaking = false;
                this.behaviorState.preparingForAttack = false;
            }, 10);
        }

        if (entities.length > 0 && distance < (5 + this.behaviorState.distanceError)) {
            this.tryAttack(target);
        }

        const dir = Vector3Builder.from(player.getViewDirection());
        dir.y = 0;
        dir.scale(0.75);

        const forward = Vector3Builder.from(player.location)
        .add(dir);

        const dim = this.manager.getAsServerPlayer().dimension;

        const blocks = [
            dim.getBlock(forward),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(0.75))),
            dim.getBlock(forward.clone().add(dir.getRotation2d().getLocalAxisProvider().getX().scale(-0.75)))
        ]
        .filter(b => b !== undefined);

        if (entities.length > 0 && system.currentTick % 5 === 0 && blocks.some(block => block.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            if (blocks.every(block => block.above()?.isSolid === false)) {
                player.jump();
                player.moveRelative(0, 1, 1);
                // player.applyKnockback(player.getViewDirection().x, player.getViewDirection().z, 0.5, player.getVelocity().y);
            }
            else {
                this.manager.pileUpBlock(this.config.block);
            }
        }
        else if (entities.length > 0 && system.currentTick % 5 === 0 && blocks.some(block => block.above()?.isSolid) && (player.getVelocity().x === 0 || player.getVelocity().z === 0)) {
            this.manager.pileUpBlock(this.config.block);
        }

        if (entities.length > 0 && distance < 4) {
            const forward = Vector3Builder.from(location)
            .getDirectionTo(target.location)
            .getRotation2d();

            const direction = forward
            .getLocalAxisProvider()
            .getX();

            if (SimulatedPlayerManager.getById(target.id) === undefined && this.behaviorState.directionToMoveAround === "RIGHT") {
                // targetがSimulatedPlayerでないときのみ
                direction.invert();
            }

            player.setRotation(forward);

            this.manager.getAsServerPlayer().selectedSlotIndex = 0;

            if (player.isOnGround) {
                // player.moveRelative(leftOrRight.get(playerManager) === "L" ? 1 : -1, 0, 1); kb使わないと移動遅すぎてだめ 他の値わざわざいじるのもね、、、
                const strength = (this.manager.armor === SimulatedPlayerArmorMaterial.NETHERITE)
                ? SIMULATED_PLAYER_BASE_SPEED * 2
                : SIMULATED_PLAYER_BASE_SPEED;

                player.applyKnockback(direction.clone().length(strength * (Math.random() / 2 + 1)), player.getVelocity().y);
                player.isSneaking = true;
            }
        }
        else if (entities.length > 0) {
            // near
            if (target.location.y - location.y > 2) {
                player.stopMoving();
                if (system.currentTick % 10 === 0) {
                    player.setItem(new ItemStack(this.config.block.material.getAsItemType()), 3, true);
                    this.manager.pileUpBlock(this.config.block);
                }
            }
            else {
                if (Math.abs(target.location.y - location.y) <= 2) {
                    player.setItem(new ItemStack(this.config.block.material.getAsItemType()), 3, true);
                    this.manager.placePathBlock(this.config.block);
                }

                const v = Vector3Builder.from(location).getDirectionTo(target.location);
                player.setRotation(v.getRotation2d());
                player.moveRelative(0, 1);

                if (system.currentTick % 12 === 0) {
                    if (distance > 5 && distance < 9) {
                        player.setItem(this.manager.projectile.clone(), 2, true);
                        player.useItemInSlot(2);
                    }
                    else if (distance > 14 && distance < 16 && this.manager.canUseEnderPearl) {
                        player.setItem(new ItemStack(Material.ENDER_PEARL.getAsItemType()), 3, true);
                        player.useItemInSlot(3);
                    }
                }

                if (system.currentTick % 20 === 0) {
                    player.isSprinting = true;
                }
            }
        }
        else {
            // far or none
            player.stopMoving();
            player.isSprinting = false;
        }
    }

    public static get(manager: SimulatedPlayerManager): CombatAIHandler {
        const constructor = (manager: SimulatedPlayerManager) => new CombatAIHandler(manager);
        return SimulatedPlayerAIHandler.__getOrCreateHandler__(manager, CombatAIHandler.ID, constructor) as CombatAIHandler;
    }

    public static readonly ID: string = "COMBAT";
}

SimulatedPlayerAIHandlerRegistry.register(CombatAIHandler);
