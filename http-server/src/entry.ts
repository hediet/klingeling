import { connectToKlingelService } from "@klingeling/service";
import express = require("express");
import basicAuth = require("express-basic-auth");

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
	const klingelService = await connectToKlingelService();
	try {
		await klingelService.openWgDoor();
	} finally {
		klingelService.dispose();
	}

	res.send({
		result: "success",
	});
});

app.post("/openMainDoor", async function(req, res) {
	const klingelService = await connectToKlingelService();
	try {
		await klingelService.openMainDoor();
	} finally {
		klingelService.dispose();
	}

	res.send({
		result: "success",
	});
});

app.listen(22328);
