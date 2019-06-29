import { EventEmitter, EventSource } from "@hediet/std/events";
import { wait } from "@hediet/std/timer";
import {
	interval,
	MonoTypeOperatorFunction,
	NEVER,
	Observable,
	OperatorFunction,
	PartialObserver,
	race,
	Subject,
} from "rxjs";
import { filter, map, mergeMap, take, tap } from "rxjs/operators";
import { openedDurationInMsType } from "./api";
import { RaspberryPi } from "./RaspberryPi";

function mergeFilter<T>(
	predicate: (arg: T) => Observable<boolean>
): MonoTypeOperatorFunction<T> {
	return mergeMap(evt =>
		predicate(evt).pipe(
			take(1),
			filter(e => e),
			map(e => evt)
		)
	);
}

function useSubject<T, O>(
	fn: (o: Observable<T>) => OperatorFunction<T, O>
): OperatorFunction<T, O> {
	return function(input: Observable<T>): Observable<O> {
		const subject = new Subject<T>();
		const observer: PartialObserver<T> = subject;
		return input.pipe(
			tap(observer),
			fn(subject)
		);
	};
}

function fromEventSource<T>(src: EventSource<T, any>): Observable<T> {
	return new Observable(sub => {
		return () =>
			src
				.sub(args => {
					sub.next(args);
				})
				.dispose();
	});
}

export class Service {
	private static instance: Service | undefined = undefined;

	public static getInstance(): Service {
		if (!this.instance) {
			this.instance = new Service();
		}
		return this.instance;
	}

	private disposed = false;

	private rpi = new RaspberryPi();

	private readonly mainDoorRelayOutput = this.rpi
		.getGpio(3)
		.initializeAsOutput();

	private mainDoorThreadCount = 0;

	private readonly wgDoorMotorCloseOutput = this.rpi
		.getGpio(20)
		.initializeAsOutput();
	private readonly wgDoorMotorOpenOutput = this.rpi
		.getGpio(21)
		.initializeAsOutput();

	private readonly ringingSignalEmitter = new EventEmitter<{
		date: Date;
		isRinging: boolean;
	}>();
	onRingingSignal = this.ringingSignalEmitter.asEvent();

	private readonly doorBellInput = this.rpi.getGpio(5).initializeAsInput({
		pullResistor: "up",
	});

	private isOpening = false;

	public readonly isRinging = fromEventSource(
		this.doorBellInput.onChange
	).pipe(
		map(r => ({ ringing: !r.value, date: new Date() })),
		tap(v => {
			console.log(
				`Door bell changed to "${v.ringing}" on ${
					v.date
				}: ${v.date.getTime()}`
			);
		}),
		useSubject(futureEvents =>
			mergeFilter(myEvent =>
				race(
					interval(7).pipe(map(x => true)),
					myEvent.ringing
						? NEVER
						: futureEvents.pipe(
								filter(x => x.ringing),
								map(x => false)
						  )
				)
			)
		),
		useSubject(futureEvents =>
			mergeFilter(myEvent =>
				race(
					interval(23).pipe(map(x => true)),
					!myEvent.ringing
						? NEVER
						: futureEvents.pipe(
								filter(x => !x.ringing),
								map(x => false)
						  )
				)
			)
		)
	);

	constructor() {
		this.reset();
	}

	public dispose() {
		this.disposed = true;
		this.reset();
	}

	private reset() {
		this.wgDoorMotorCloseOutput.setValue(false);
		this.wgDoorMotorOpenOutput.setValue(false);
		this.mainDoorRelayOutput.setValue(true);
	}

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
