import { connectToKlingelService } from "@klingeling/service";

main();

/*const openTime = parseInt(process.argv[2], 10);
const closeTime = parseInt(process.argv[3], 10);*/

async function main() {
	const klingelService = await connectToKlingelService({
		bellStateChanged: args => {
			console.log("bell: ", args);
		},
	});
	//await klingelService.openWgDoor();

	klingelService.dispose();
}
