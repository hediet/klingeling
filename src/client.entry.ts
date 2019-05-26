import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { KlingelApi } from "./service/api";

main();

/*const openTime = parseInt(process.argv[2], 10);
const closeTime = parseInt(process.argv[3], 10);*/

async function main() {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port: 42319,
	});
	const { server } = KlingelApi.getServerFromStream(stream, undefined, {});
	await server.openWgDoor({});

	stream.close();
}
