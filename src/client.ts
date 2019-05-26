import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { KlingelApi } from "./api";
import { wait } from "@hediet/std/timer";

main();

const openTime = parseInt(process.argv[2], 10);
const closeTime = parseInt(process.argv[3], 10);

async function main() {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port: 42319,
	});
	const { server } = KlingelApi.getServerFromStream(stream, undefined, {});

	await wait(0);

	await server.openWgDoorConfig({
		openTime,
		closeTime,
	});

	stream.close();
}
