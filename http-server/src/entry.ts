import { connectToKlingelService } from "@klingeling/service";
import express = require("express");
import basicAuth = require("express-basic-auth");

const app = express();

app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

if (false) {
	// uses nginx authentication now.
	app.use(
		basicAuth({
			users: { admin: "7YwW1LLq" },
			challenge: true,
			realm: "DBbD3nelVX4l",
		})
	);
}

app.get("/status", function(req, res) {
	res.send({ status: "ok" });
});

app.post("/openWgDoor", async function(req, res) {
	const klingelService = await connectToKlingelService();
	try {
		await klingelService.openWgDoor({
			reason: {
				type: "http",
				username: req.body.user || "HACKER",
			},
		});
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
		await klingelService.openMainDoor({
			reason: { type: "http", username: req.body.user || "HACKER" },
		});
	} finally {
		klingelService.dispose();
	}

	res.send({
		result: "success",
	});
});

app.listen(22328);
