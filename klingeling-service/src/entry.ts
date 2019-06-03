import { ConsoleRpcLogger, ConsoleStreamLogger } from "@hediet/typed-json-rpc";
import { startWebSocketServer } from "@hediet/typed-json-rpc-websocket-server";
import { KlingelApi, port } from "./api";
import { Service } from "./service";

class Main {
	private readonly service = Service.getInstance();
	private readonly clients = new Set<typeof KlingelApi.TClientInterface>();

	constructor() {
		this.registerSignalHandler();

		startWebSocketServer({ port }, async stream => {
			const { client } = KlingelApi.registerServerToStream(
				new ConsoleStreamLogger(stream),
				new ConsoleRpcLogger(),
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
					openWgDoorConfig: async ({ closeTime, openTime }) => {
						await this.service.openWgDoor({ closeTime, openTime });
					},
					bellStateChanged: async args => {
						for (const c of this.clients) {
							c.bellStateChanged(args);
						}
					},
				}
			);

			console.log("client connected ", stream.toString());
			this.clients.add(client);
			await stream.onClosed;
			this.clients.delete(client);
			console.log("client disconnected ", stream.toString());
		});
	}

	private async registerSignalHandler() {
		await this.service.onReady;

		for (const signal of [
			"SIGHUP",
			"SIGINT",
			"SIGTERM",
			"SIGCONT",
		] as const) {
			process.on(signal, () => this.shutdown());
		}
	}

	private async shutdown() {
		console.log("Exiting gracefully...");
		await this.service.dispose();
		process.exit();
	}
}

new Main();
