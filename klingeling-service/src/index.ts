import { port, KlingelApi } from "./api";
import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import { Disposable } from "@hediet/std/disposable";

export { port, KlingelApi };

export async function connectToKlingelService(): Promise<
	typeof KlingelApi.TServerInterface & Disposable
> {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port,
	});
	const { server } = KlingelApi.getServerFromStream(stream, undefined, {});

	return Object.assign({}, server, { dispose: () => stream.dispose() });
}
