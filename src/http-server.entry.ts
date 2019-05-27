import { KlingelApi } from "./service/api";
import { WebSocketStream } from "@hediet/typed-json-rpc-websocket";
import express = require("express");
import basicAuth = require("express-basic-auth");

async function connect(): Promise<{
	server: typeof KlingelApi.TServerInterface;
	dispose: () => void;
}> {
	const stream = await WebSocketStream.connectTo({
		host: "klingelpi",
		port: 42319,
	});
	const { server } = KlingelApi.getServerFromStream(stream, undefined, {});
	return { server, dispose: () => stream.dispose() };
}

const app = express();

app.use(
	basicAuth({
		users: { admin: "7YwW1LLq" },
		challenge: true,
		realm: "DBbD3nelVX4l",
	})
);

app.get("/status", function(req, res) {
	res.send({ status: "ok" });
});

app.post("/openWgDoor", async function(req, res) {
	const { server, dispose } = await connect();
	try {
		await server.openWgDoor();
	} finally {
		dispose();
	}

	res.send({
		result: "success",
	});
});

app.post("/openMainDoor", async function(req, res) {
	const { server, dispose } = await connect();
	try {
		await server.openMainDoor();
	} finally {
		dispose();
	}

	res.send({
		result: "success",
	});
});

app.listen(22328);
