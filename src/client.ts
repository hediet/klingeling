import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { KlingelApi } from "./api";
import { wait } from "@hediet/std/timer";

main();

async function main() {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port: 42319,
	});
	const { server } = KlingelApi.getServerFromStream(stream, undefined, {});

	await wait(0);

	await server.openWgDoor({});

	stream.close();
}
