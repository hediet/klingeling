import { connectToKlingelService } from "@klingeling/service";
import { spawn } from "child_process";
import { ResettableTimeout } from "@hediet/std/timer";

main();

async function main() {
	const klingelService = await connectToKlingelService();

	const cp = spawn(
		"soundmeter",
		["-t", "15", "2", "--segment", "0.1", "-p", "test", "-a", "exec"],
		{
			stdio: "pipe",
		}
	);

	let timeout: ResettableTimeout | undefined = undefined;

	cp.stdout.on("data", data => {
		const str: string = data.toString();
		if (str.indexOf("Exec Action triggered") !== -1) {
			if (!timeout) {
				console.log("ringing started");
				timeout = new ResettableTimeout(200);
				klingelService.notifyBellHasRung();
				timeout.onTimeout.then(() => {
					console.log("ringing stopped");
					timeout = undefined;
				});
			}

			timeout!.reset();
		}
	});
}
