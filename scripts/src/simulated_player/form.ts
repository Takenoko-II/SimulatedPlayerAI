import { ActionFormWrapper, MessageFormWrapper, ModalFormWrapper } from "../lib/UI-2.0";
import { CombatAIHandler, NoneAIHandler } from "./AI";
import { SimulatedPlayerAIHandlerRegistry, SIMULATED_PLAYER_DEFAULT_NAME, SimulatedPlayerArmorMaterial, SimulatedPlayerAuxiliary, SimulatedPlayerWeaponMaterial } from "./enumerations";
import { SimulatedPlayerManager } from "./SimulatedPlayerManager";

export const FORM = {
    main(): ActionFormWrapper {
        return new ActionFormWrapper()
        .title("Simulated Player Manager")
        .button({
            name: "§a召喚",
            iconPath: "textures/ui/color_plus",
            on(player) {
                FORM.spawn().open(player);
            }
        })
        .button({
            name: "§9コンフィグ",
            iconPath: "textures/ui/settings_glyph_color_2x",
            on(player) {
                FORM.list(manager => {
                    FORM.config(manager).open(player);
                }).open(player);
            }
        })
        .button({
            name: "§3再読み込み",
            iconPath: "textures/items/ender_pearl",
            on(player) {
                FORM.list(manager => {
                    FORM.reload(manager);
                    FORM.main().open(player);
                }).open(player);
            }
        })
        .button({
            name: "§c削除",
            iconPath: "textures/ui/trash_default",
            on(player) {
                FORM.list(manager => {
                    FORM.delete(manager).open(player);
                }).open(player);
            }
        })
        .button({
            name: "§4全プレイヤーを削除",
            iconPath: "textures/ui/realms_red_x",
            on(player) {
                FORM.deleteAll().open(player);
            }
        })
    },

    spawn(): ModalFormWrapper {
        return new ModalFormWrapper()
        .title("Spawn Simulated Player")
        .textField({
            id: "name",
            label: "プレイヤー名",
            placeHolder: "ここにプレイヤー名を入力",
            defaultValue: SIMULATED_PLAYER_DEFAULT_NAME
        })
        .submitButton({
            name: "召喚する",
            on(event) {
                SimulatedPlayerManager.requestSpawnPlayer({
                    name: event.getTextFieldInput("name")!,
                    onCreate(player, time) {
                        player.setAIById(CombatAIHandler.ID);
                        console.warn(player.getAsServerPlayer().name + " joined. (" + time + "ms)");
                    }
                });
            }
        });
    },

    delete(manager: SimulatedPlayerManager): MessageFormWrapper {
        return new MessageFormWrapper()
        .title("Delete Simulated Player")
        .body(manager.getAsGameTestPlayer().name + "を削除しますか？")
        .button1({
            name: "y",
            on(player) {
                manager.getAsGameTestPlayer().disconnect();
            }
        })
        .button2({
            name: "n",
            on(player) {
                FORM.main().open(player);
            }
        });
    },

    deleteAll(): MessageFormWrapper {
        return new MessageFormWrapper()
        .title("Delete All Simulated Player")
        .body("全プレイヤーを削除しますか？")
        .button1({
            name: "y",
            on(player) {
                SimulatedPlayerManager.getManagers().forEach(manager => manager.getAsGameTestPlayer().disconnect());
            }
        })
        .button2({
            name: "n",
            on(player) {
                FORM.main().open(player);
            }
        });
    },

    list(callback: (manager: SimulatedPlayerManager) => void): ActionFormWrapper {
        const list = new ActionFormWrapper()
            .title("List of Simulated Player");

        for (const player of SimulatedPlayerManager.getManagers()) {
            list.button({
                name: "§6" + player.getAsGameTestPlayer().name,
                tags: ["player", player.getAsGameTestPlayer().id]
            })
        }

        list.divider({ id: "div" });

        list.button({
            name: "Back",
            iconPath: "textures/ui/back_button_default",
            on(player) {
                FORM.main().open(player);
            }
        })
        .onPush(button => button.tags.includes("player"), event => {
            const manager = SimulatedPlayerManager.getById(event.button.tags[1]);
            if (manager === undefined) return;
            callback(manager);
        });
        return list;
    },

    config(manager: SimulatedPlayerManager): ModalFormWrapper {
        const armorMaterials = Object.values(SimulatedPlayerArmorMaterial);
        const weaponMaterials = Object.values(SimulatedPlayerWeaponMaterial);
        const auxiliaries = Object.values(SimulatedPlayerAuxiliary);

        const aiTypes = SimulatedPlayerAIHandlerRegistry.getRegisteredIds();

        return new ModalFormWrapper()
        .title("Simulated Player Config")
        .dropdown({
            id: "armor",
            label: "防具",
            list: armorMaterials.map(v => ({ id: v, text: v })),
            defaultValueIndex: armorMaterials.indexOf(manager.armor)
        })
        .dropdown({
            id: "weapon",
            label: "近接武器",
            list: weaponMaterials.map(v => ({ id: v, text: v })),
            defaultValueIndex: weaponMaterials.indexOf(manager.weapon)
        })
        .dropdown({
            id: "auxiliary",
            label: "オフハンド",
            list: auxiliaries.map(v => ({ id: v, text: v })),
            defaultValueIndex: auxiliaries.indexOf(manager.auxiliary)
        })
        .dropdown({
            id: "ai",
            label: "AI",
            list: aiTypes.map(v => ({ id: v, text: v })),
            defaultValueIndex: aiTypes.indexOf(SimulatedPlayerAIHandlerRegistry.getIdOfHandler(manager.getAIHandler()))
        })
        .submitButton({
            name: { translate: "gui.submit" },
            on(event) {
                manager.setAIById(event.getDropdownInput("ai")?.value.id!);
                manager.armor = armorMaterials.find(armor => armor === event.getDropdownInput("armor")?.value.id)!;
                manager.weapon = weaponMaterials.find(weapon => weapon === event.getDropdownInput("weapon")?.value.id)!;
                manager.auxiliary = auxiliaries.find(auxiliary => auxiliary === event.getDropdownInput("auxiliary")?.value.id)!;
            }
        });
    },

    reload(manager: SimulatedPlayerManager) {
        manager.reload().then(() => {
            console.warn("reload: " + manager.getAsGameTestPlayer().name);
        });
    }
} as const;
