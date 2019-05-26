import { init } from "raspi";
import { DigitalOutput, PULL_UP, PULL_DOWN } from "raspi-gpio";
import { Barrier } from "@hediet/std/synchronization";
import { wait } from "@hediet/std/timer";
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

	public async openMainDoor(openedDurationInMs: number): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
		await s.openMainDoor(openedDurationInMs);
	}

	public async openWgDoor(): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
		await s.openWgDoor();
	}

	public async dispose(): Promise<void> {
		const s = await this.initializedBarrier.onUnlocked;
	}
}

class InitializedService {
	private readonly mainDoorRelayOutput = new DigitalOutput({
		pullResistor: PULL_UP,
		pin: "GPIO3",
	});

	private mainDoorCount = 0;
	public async openMainDoor(openedDurationInMs: number): Promise<void> {
		if (!openedDurationInMsType.is(openedDurationInMs)) {
			throw new Error("Invalid time interval!");
		}

		this.mainDoorCount++;
		try {
			if (this.mainDoorCount === 1) {
				this.mainDoorRelayOutput.write(0);
			}
			await wait(openedDurationInMs);
		} finally {
			this.mainDoorCount--;

			if (this.mainDoorCount === 0) {
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

    constructor() {
        this.wgDoorMotorCloseOutput.write(0);
        this.wgDoorMotorOpenOutput.write(0);
    }

	private isOpening = false;

	public async openWgDoor(): Promise<void> {
		console.log("open");

		if (this.isOpening) {
			return;
		}

		this.isOpening = true;

		try {
			this.wgDoorMotorOpenOutput.write(1);
		} finally {
			await wait(5000);
			this.wgDoorMotorOpenOutput.write(0);
		}

		try {
			this.wgDoorMotorCloseOutput.write(1);
			await wait(5000);
		} finally {
			this.wgDoorMotorCloseOutput.write(0);
		}

		this.isOpening = false;
	}
}
