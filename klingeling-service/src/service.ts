import { Barrier } from "@hediet/std/synchronization";
import { wait } from "@hediet/std/timer";
import { computed, observable } from "mobx";
import { init } from "raspi";
import {
	DigitalInput,
	DigitalOutput,
	HIGH,
	LOW,
	PULL_DOWN,
	PULL_UP,
} from "raspi-gpio";
import { openedDurationInMsType } from "./api";

export class Service {
	private static instance: Service | undefined = undefined;

	public static getInstance(): Service {
		if (!this.instance) {
			this.instance = new Service();
		}
		return this.instance;
	}

	private readonly initializedBarrier = new Barrier<InitializedService>();

	private constructor() {
		init(() => {
			this.initializedBarrier.unlock(new InitializedService());
		});
	}

	public readonly onReady = this.initializedBarrier.onUnlocked.then(() => {});

	@computed
	public get ringing(): boolean {
		if (this.initializedBarrier.state === "resolved") {
			let ringing = false;
			this.initializedBarrier.onUnlocked.then(s => {
				ringing = s.ringing;
			});
			return ringing;
		} else {
			return false;
		}
	}

	public async openMainDoor(openedDurationInMs: number): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
		await s.openMainDoor(openedDurationInMs);
	}

	public async openWgDoor(args?: {
		openTime: number;
		closeTime: number;
	}): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
		await s.openWgDoor(args);
	}

	public async dispose(): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
		await s.dispose();
	}
}

class InitializedService {
	private disposed = false;

	public async dispose(): Promise<void> {
		this.disposed = true;
		this.reset();
	}

	private readonly mainDoorRelayOutput = new DigitalOutput({
		pullResistor: PULL_UP,
		pin: "GPIO3",
	});

	private mainDoorThreadCount = 0;
	public async openMainDoor(openedDurationInMs: number): Promise<void> {
		if (this.disposed) {
			throw new Error("Service already disposed!");
		}

		if (!openedDurationInMsType.is(openedDurationInMs)) {
			throw new Error("Invalid time interval!");
		}

		this.mainDoorThreadCount++;
		try {
			if (this.mainDoorThreadCount === 1) {
				this.mainDoorRelayOutput.write(0);
			}
			await wait(openedDurationInMs);
		} finally {
			this.mainDoorThreadCount--;

			if (this.mainDoorThreadCount === 0) {
				this.mainDoorRelayOutput.write(1);
			}
		}
	}

	private readonly wgDoorMotorCloseOutput = new DigitalOutput({
		pullResistor: PULL_DOWN,
		pin: "GPIO20",
	});

	private readonly wgDoorMotorOpenOutput = new DigitalOutput({
		pullResistor: PULL_DOWN,
		pin: "GPIO21",
	});

	@observable ringing: boolean = false;

	private readonly doorBellInput = new DigitalInput({
		pullResistor: PULL_UP,
		pin: "GPIO5",
	});

	constructor() {
		this.reset();

		this.doorBellInput.on("change", (value: number) => {
			if (value == LOW) {
				this.ringing = true;
			} else if (value === HIGH) {
				this.ringing = false;
			} else {
				console.error("unexpected value");
			}
		});
	}

	private reset() {
		this.wgDoorMotorCloseOutput.write(0);
		this.wgDoorMotorOpenOutput.write(0);
		this.mainDoorRelayOutput.write(1);
	}

	private isOpening = false;

	public async openWgDoor(args?: {
		openTime: number;
		closeTime: number;
	}): Promise<void> {
		if (this.disposed) {
			throw new Error("Service already disposed!");
		}

		if (this.isOpening) {
			return;
		}

		const openTime = args ? args.openTime : 17600;
		const closeTime = args ? args.closeTime : 15500;

		this.isOpening = true;

		try {
			try {
				this.wgDoorMotorOpenOutput.write(1);
				await wait(openTime);
			} finally {
				if (this.disposed) {
					return;
				}
				this.wgDoorMotorOpenOutput.write(0);
			}

			try {
				this.wgDoorMotorCloseOutput.write(1);
				await wait(closeTime);
			} finally {
				if (this.disposed) {
					return;
				}
				this.wgDoorMotorCloseOutput.write(0);
			}
		} finally {
			this.isOpening = false;
		}
	}
}
