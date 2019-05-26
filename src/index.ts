import { startWebSocketServer } from "@hediet/typed-json-rpc-websocket-server";
import { KlingelApi, port } from "./api";
import { Service } from "./service";

class Main {
	private readonly service = Service.getInstance();
	private readonly clients = new Set<typeof KlingelApi.TClientInterface>();

	constructor() {
		startWebSocketServer({ port }, async stream => {
			const { client } = KlingelApi.registerServerToStream(
				stream,
				undefined,
				{
					openMainDoor: async args => {
						let openedDurationInMs = 3000;
						if ("openedDurationInMs" in args) {
							openedDurationInMs = args.openedDurationInMs;
						}

						for (const c of this.clients) {
							c.mainDoorOpened({});
						}
						await this.service.openMainDoor(openedDurationInMs);
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
