import { NestFactory } from "@nestjs/core";
import { Module, Controller, Get, Post } from "@nestjs/common";
import { KlingelApi } from "./service/api";
import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";

@Controller()
export class MainController {
	async connect(): Promise<{
		server: typeof KlingelApi.TServerInterface;
		dispose: () => void;
	}> {
		const stream = await WebSocketStream.connectTo({
			host: "klingelpi",
			port: 42319,
		});
		const { server } = KlingelApi.getServerFromStream(
			stream,
			undefined,
			{}
		);
		return { server, dispose: () => stream.dispose() };
	}

	@Post("openWgDoor")
	async openWgDoor() {
		const { server, dispose } = await this.connect();
		try {
			await server.openWgDoor({});
		} finally {
			dispose();
		}

		return {
			result: "success",
		};
	}

	@Post("openMainDoor")
	async openMainDoor() {
		const { server, dispose } = await this.connect();
		try {
			await server.openMainDoor({});
		} finally {
			dispose();
		}

		return {
			result: "success",
		};
	}
}

@Module({
	controllers: [MainController],
})
export class ApplicationModule {
	constructor() {}
}

async function main() {
	const app = await NestFactory.create(ApplicationModule);
	return await app.listen(22328);
}

main();
