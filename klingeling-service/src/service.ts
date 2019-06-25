import { Disposable } from "@hediet/std/disposable";
import { Barrier } from "@hediet/std/synchronization";
import { startTimeout, wait } from "@hediet/std/timer";
import { computed, observable } from "mobx";
import { fromPromise } from "mobx-utils";
import { openedDurationInMsType } from "./api";
import { RaspberryPi } from "./RaspberryPi";

export class Service {
	private static instance: Service | undefined = undefined;

	public static getInstance(): Service {
		if (!this.instance) {
			this.instance = new Service();
		}
		return this.instance;
	}

	private readonly initializedBarrier = new Barrier<InitializedService>();
	private readonly initialized = fromPromise(
		this.initializedBarrier.onUnlocked
	);

	private constructor() {
		this.initializedBarrier.unlock(new InitializedService());
	}

	public readonly onReady = this.initializedBarrier.onUnlocked.then(() => {});

	@computed
	public get ringing(): boolean {
		if (this.initialized.state === "fulfilled") {
			return this.initialized.value.ringing;
		}
		return false;
	}

	public async openMainDoor(openedDurationInMs: number): Promise<void> {
		const s = await this.initialized;
		await s.openMainDoor(openedDurationInMs);
	}

	public async openWgDoor(args?: {
		openTime: number;
		closeTime: number;
	}): Promise<void> {
		const s = await this.initialized;
		await s.openWgDoor(args);
	}

	public async dispose(): Promise<void> {
		const s = await this.initialized;
		await s.dispose();
	}
}

class InitializedService {
	private disposed = false;

	private rpi = new RaspberryPi();

	public async dispose(): Promise<void> {
		this.disposed = true;
		this.reset();
	}

	private readonly mainDoorRelayOutput = this.rpi
		.getGpio(3)
		.initializeAsOutput();

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
				this.mainDoorRelayOutput.setValue(false);
			}
			await wait(openedDurationInMs);
		} finally {
			this.mainDoorThreadCount--;

			if (this.mainDoorThreadCount === 0) {
				this.mainDoorRelayOutput.setValue(true);
			}
		}
	}

	private readonly wgDoorMotorCloseOutput = this.rpi
		.getGpio(20)
		.initializeAsOutput();
	private readonly wgDoorMotorOpenOutput = this.rpi
		.getGpio(21)
		.initializeAsOutput();

	@observable ringing: boolean = false;

	private readonly doorBellInput = this.rpi.getGpio(5).initializeAsInput({
		pullResistor: "up",
	});

	constructor() {
		this.reset();

		let timeoutDisposable: Disposable | undefined = undefined;

		this.doorBellInput.onChange.sub(({ value }) => {
			const d = new Date();
			console.log(
				`Door bell input changed to "${value}" on ${d}: ${d.getMilliseconds()}`
			);
			const ringing = !value;
			if (ringing && !this.ringing && !timeoutDisposable) {
				timeoutDisposable = startTimeout(50, () => {
					this.ringing = true;
				});
			} else if (!ringing && this.ringing) {
				if (timeoutDisposable) {
					timeoutDisposable.dispose();
					timeoutDisposable = undefined;
				}
				this.ringing = false;
			}
		});
	}

	private reset() {
		this.wgDoorMotorCloseOutput.setValue(false);
		this.wgDoorMotorOpenOutput.setValue(false);
		this.mainDoorRelayOutput.setValue(true);
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

		const openTime = args ? args.openTime : 18300;
		const closeTime = args ? args.closeTime : 15500;

		this.isOpening = true;

		try {
			try {
				this.wgDoorMotorOpenOutput.setValue(true);
				await wait(openTime);
			} finally {
				if (this.disposed) {
					return;
				}
				this.wgDoorMotorOpenOutput.setValue(false);
			}

			try {
				this.wgDoorMotorCloseOutput.setValue(true);
				await wait(closeTime);
			} finally {
				if (this.disposed) {
					return;
				}
				this.wgDoorMotorCloseOutput.setValue(false);
			}
		} finally {
			this.isOpening = false;
		}
	}
}
