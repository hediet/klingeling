import { connectToKlingelService } from "@klingeling/service";
import { spawn } from "child_process";

const ringringFifo = process.argv[2];

main();

async function main() {
	const klingelService = await connectToKlingelService();

	const uid = "trigger-ring-does-not-exist";

	const cp = spawn(
		"soundmeter",
		["-t", "15", "2", "--segment", "0.1", "-p", "test", "-a", "exec"],
		{
			stdio: "pipe",
		}
	);

	cp.stdout.on("data", data => {
		console.log(data, data.toString());
	});
	cp.stdout.on("error", data => {
		console.log(data, data.toString());
	});
	cp.stderr.on("data", data => {
		console.log(data, data.toString());
	});
}
