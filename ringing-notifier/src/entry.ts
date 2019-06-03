import { Disposable } from "@hediet/std/disposable";
import { EventEmitter, EventSource } from "@hediet/std/events";
import { ResettableTimeout, startTimeout } from "@hediet/std/timer";
import { connectToKlingelService } from "@klingeling/service";
import { spawn } from "child_process";

main();

interface Observable<T> {
	value: T;
	onChange: EventSource<{ newValue: T; oldValue: T }, Observable<T>>;
}

class SimpleObservable<T> implements Observable<T> {
	private _value: T;
	private changeEmitter = new EventEmitter<
		{ newValue: T; oldValue: T },
		Observable<T>
	>();

	public onChange = this.changeEmitter.asEvent();

	constructor(initialValue: T) {
		this._value = initialValue;
	}

	public get value(): T {
		return this._value;
	}

	public setValue(newValue: T) {
		if (newValue !== this._value) {
			const oldValue = this._value;
			this._value = newValue;
			this.changeEmitter.emit({ newValue, oldValue }, this);
		}
	}

	public asObservable(): Observable<T> {
		return this;
	}
}

class Soundmeter {
	private isRingingObservable = new SimpleObservable<boolean | "broken">(
		false
	);
	public isRinging = this.isRingingObservable.asObservable();

	constructor() {
		const cp = spawn(
			"soundmeter",
			[
				"-t",
				"15000",
				"2",
				"--segment",
				"0.1",
				"-p",
				"test",
				"-a",
				"exec",
			],
			{
				stdio: "pipe",
			}
		);

		const actionTriggered = new EventEmitter();
		cp.stdout.on("data", data => {
			const str: string = data.toString();
			if (str.indexOf("Exec Action triggered") !== -1) {
				console.log("...triggered");
				actionTriggered.emit();
			}
		});

		let timeout: ResettableTimeout | undefined = undefined;
		actionTriggered.sub(() => {
			if (!timeout) {
				this.isRingingObservable.setValue(true);
				timeout = new ResettableTimeout(500);
				timeout.onTimeout.then(() => {
					this.isRingingObservable.setValue(false);
					timeout = undefined;
				});
			} else {
				timeout.reset();
			}
		});

		let brokenTimeout: Disposable = Disposable.empty;
		this.isRinging.onChange.sub(({ newValue }) => {
			if (newValue) {
				brokenTimeout = startTimeout(10 * 1000, () => {
					this.isRingingObservable.setValue("broken");
				});
			} else {
				brokenTimeout.dispose();
			}
		});
	}
}

async function main() {
	const klingelService = await connectToKlingelService();

	const soundmeter = new Soundmeter();
	soundmeter.isRinging.onChange.sub(({ newValue }) => {
		if (newValue === true) {
			console.log("ringing started");
		} else if (newValue === false) {
			console.log("ringing stopped");
		} else if (newValue === "broken") {
			console.log("bell broken :(");
		}

		klingelService.bellStateChanged({
			isBroken: newValue === "broken",
			isRinging: newValue === true,
		});
	});
}
