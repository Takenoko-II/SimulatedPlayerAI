// @ts-nocheck
/**
 * @typedef {import("@minecraft/server").Player} Player
 */

import { system, world } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

/**
 * @param {string} action
 * @param {unknown} payload
 */
function sendAction(action, payload) {
    const json = JSON.stringify({ action, payload });
    console.warn(`bds_enhancer:${json}`);
}
  
/**
   * @param {Player} player
   * @param {string} host
   * @param {number} port
   */
export function sendTransferAction(player, host, port) {
    if(player.getDynamicProperty(`gamertag`)) {
        sendAction("transfer", { player: `"${player.getDynamicProperty(`gamertag`)}"`, host, port });
        return;
    };
    sendAction("transfer", { player: `"${player.name}"`, host, port });
}
  
/**
 * @param {Player} player
 * @param {string} reason
 */
export function sendKickAction(player, reason) {
    sendAction("kick", { player: player.name, reason });
};
  
export function sendStopAction() {
    sendAction("stop");
};
  
export function sendReloadAction() {
    sendAction("reload");
};

system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === `karo:server`) {
        const [ host , port ] = ev.message.split(`:`);
        sendTransferAction(ev.sourceEntity,host,Number(port));
        return;
    };
    if (ev.id === `karo:gamertag`) {
        gamertagForm(ev.sourceEntity);
        return;
    };
});

/**
 * 
 * @param {Player} player 
 */
function gamertagForm(player) {
    const form = new ModalFormData();
    form.textField(`ゲーマータグ`, `ゲーマータグを入力してください`, player.getDynamicProperty(`gamertag`) ?? "");
    form.show(player).then((rs) => {
        if (rs.canceled) {
            if (rs.cancelationReason === "UserBusy") {
                gamertagForm(player);
                return;
            };
            return;
        };
        const value = rs.formValues[0];
        if (value === "") {
            player.setDynamicProperty(`gamertag`);
            player.sendMessage(`§a参加時に認証するゲーマータグをデフォルトネームにリセットしました`)
            return;
        } else {
            player.setDynamicProperty(`gamertag`, value);
            player.sendMessage(`§a参加時に認証するゲーマータグを「${value}」にしました`)
            return;
        };
    });
};

system.runInterval(() => {
    const date = new Date();
    const minute =  date.getMinutes();
    if(minute == 20) {
        world.sendMessage(`§a[KaroseumPvP]\n§b10分後再起動を行います`);
    };
    if(minute == 25) {
        world.sendMessage(`§a[KaroseumPvP]\n§b5分後再起動を行います`);
    };
    if(minute == 29) {
        world.sendMessage(`§a[KaroseumPvP]\n§b1分後再起動を行います`);
    };
    if(minute == 30) {
        world.sendMessage(`§a[KaroseumPvP]\n§b再起動を行います`);
        system.runTimeout(() => {
            world.getPlayers().forEach(p => {
                try {
                    p.runCommand(`kick "${p.name}" server restart`);
                } catch (error) {
                    
                }
            });
        },100)
        system.runTimeout(() => {
            sendStopAction();
        },200)
    };
},20*60);