import { Disposable } from "@hediet/std/disposable";
import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { KlingelApi, port } from "./api";

export { port, KlingelApi };

export async function connectToKlingelService(
	handler: typeof KlingelApi.TClientHandler = {}
): Promise<typeof KlingelApi.TServerInterface & Disposable> {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port,
	});
	const { server } = KlingelApi.getServerFromStream(
		stream,
		undefined,
		handler
	);

	return Object.assign({}, server, { dispose: () => stream.dispose() });
}
