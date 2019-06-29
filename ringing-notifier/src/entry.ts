import { connectToKlingelService } from "@klingeling/service";
import { spawn } from "child_process";
import { fromEvent, merge, Observable, of } from "rxjs";
import {
	concatMap,
	debounceTime,
	filter,
	map,
	mapTo,
	take,
	throttle,
	timeoutWith,
} from "rxjs/operators";

main();

const soundmeterArgs = [
	"--trigger",
	"15000", // RMS > 15k
	"2", // for two frames
	"--segment", // of length 100ms
	"0.1",
	"-p",
	"test",
	"-a",
	"exec",
];
class Soundmeter {
	ringingEdges: Observable<boolean | "broken">;
	constructor() {
		// soundmeter is a simple python library that measures loudness as RMS of amplitude over time frames, that you can use as a trigger
		// see https://pypi.org/project/soundmeter/
		const soundmeter = spawn("soundmeter", soundmeterArgs, {
			stdio: "pipe",
		});

		const ringing = fromEvent<Buffer>(soundmeter.stdout, "data").pipe(
			map(data => data.toString()),
			filter(data => data.includes("Exec Action triggered")),
			mapTo("RINGRING" as const)
		);

		const trailingEdge = ringing.pipe(
			debounceTime(500),
			mapTo(false)
		);

		const leadingEdge = ringing.pipe(
			throttle(() => trailingEdge),
			mapTo(true)
		);

		// the microphone is crap and has a loose connection
		// set state to broken if it seems like someone is ringing for 10+ seconds
		// (this is buggy, todo: figure out how rxjs works)
		const brokenEdge = leadingEdge.pipe(
			concatMap(() =>
				trailingEdge.pipe(
					take(1),
					timeoutWith(10000, of("broken" as const)),
					filter(e => e === "broken")
				)
			)
		);

		this.ringingEdges = merge(leadingEdge, trailingEdge, brokenEdge);
	}
}

async function main() {
	const klingelService = await connectToKlingelService();

	const soundmeter = new Soundmeter();
	soundmeter.ringingEdges.subscribe(newValue => {
		if (newValue === true) {
			console.log("ringing started");
		} else if (newValue === false) {
			console.log("ringing stopped");
		} else if (newValue === "broken") {
			console.log("bell broken :(");
		}

		/*
		klingelService.bellStateChanged({
			isBroken: newValue === "broken",
			isRinging: newValue === true,
		});
		*/
	});
}
