import { connectToKlingelService } from "@klingeling/service";
import { spawn } from "child_process";

const ringringFifo = process.argv[2];

main();

async function main() {
	const klingelService = await connectToKlingelService();
	await klingelService.openWgDoor();

	const uid = "trigger-ring-does-not-exist";

	const cp = spawn("soundmeter", [
		"-t 15000",
		"2",
		"--segment 0.1",
		"-p test",
		"-a exec",
		`-e ./${uid}.sh`,
	]);

	cp.stdout.on("data", data => {
		console.log(data, data.toString());
	});
}
