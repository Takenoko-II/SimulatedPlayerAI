// @ts-nocheck
import { system, world } from "@minecraft/server";
import { http, HttpRequest, HttpHeader, HttpRequestMethod } from "@minecraft/server-net";

world.afterEvents.worldInitialize.subscribe(async ()=>{
    const req = new HttpRequest("http://localhost:3000/");
    req.body = JSON.stringify({
        hubServerStart: true
    });

    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json")
    ];
    await http.request(req);
    console.warn("[Success] Send http request:", req.body);
})

world.afterEvents.chatSend.subscribe(async (ev) => {
    const { sender: player } = ev;

    const req = new HttpRequest("http://localhost:3000/");
    req.body = JSON.stringify({
        hubSenderName: player.name,
        hubText: ev.message,
        minecraftId: player.id
    });

    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json")
    ];
    await http.request(req);
    console.warn("[Success] Send http request:", req.body);
});

let chat = "";
system.runInterval(async () => {
    const res = await http.get("http://localhost:3000/server2");
    if (res.body !== chat) {
        chat = res.body;
        world.sendMessage(`§1§2 [§bDiscord-§r§l${JSON.parse(res.body).hubAuthorName}§1§2] §r ${JSON.parse(res.body).hubText}`);
    }
}, 10);

world.beforeEvents.playerLeave.subscribe(async (ev) => {
    const { player } = ev;
    const pName = player.name;
    const pId = player.id;
    system.run(() => {
        const req = new HttpRequest("http://localhost:3000/");
        req.body = JSON.stringify({
            hubLeavePlayerName: pName,
            minecraftId: pId,
        });

        req.method = HttpRequestMethod.Post;
        req.headers = [
            new HttpHeader("Content-Type", "application/json")
        ];
        http.request(req);
        console.warn("[Success] Send http request:", req.body);
    });
});

world.afterEvents.playerSpawn.subscribe(async (ev) => {
    const { player } = ev;
    if(!ev.initialSpawn) return;
    const req = new HttpRequest("http://localhost:3000/");
    req.body = JSON.stringify({
            minecraftId: player.id,
            hubJoinPlayerName: player.name,
    });

    req.method = HttpRequestMethod.Post;
    req.headers = [
        new HttpHeader("Content-Type", "application/json")
    ];
    await http.request(req);
    console.warn("[Success] Send http request:", req.body);
});