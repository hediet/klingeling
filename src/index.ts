import { startWebSocketServer } from "@hediet/typed-json-rpc-websocket-server";
import { KlingelApi } from "./api";
import { Service } from "./service";

class Main {
	private readonly service = Service.getInstance();
	private readonly clients = new Set<typeof KlingelApi.TClientInterface>();

	constructor() {
		startWebSocketServer({ port: 42319 }, async stream => {
			const { client } = KlingelApi.registerServerToStream(
				stream,
				undefined,
				{
					openMainDoor: async () => {
						for (const c of this.clients) {
							c.mainDoorOpened({});
						}
						await this.service.openMainDoor(3000);
					},
					openWgDoor: async () => {
						for (const c of this.clients) {
							c.wgDoorOpened({});
						}
						await this.service.openWgDoor();
					},
					notifyBellHasRung: async () => {
						for (const c of this.clients) {
							c.bellRinged({});
						}
					},
				}
			);

			this.clients.add(client);
			await stream.onClosed;
			this.clients.delete(client);
		});
	}
}

new Main();
