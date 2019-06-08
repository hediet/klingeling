import { EventEmitter, EventSource } from "@hediet/std/events";
import { Gpio } from "pigpio";

export class RaspberryPi {
	private gpios = new Map<number, GpioPin>();

	public getGpio(gpio: number): GpioPin {
		let r = this.gpios.get(gpio);
		if (!r) {
			r = new GpioPin(gpio);
			this.gpios.set(gpio, r);
		}
		return r;
	}
}

interface InputConfig {
	pullResistor: "up" | "down" | "none";
}

export class GpioPin {
	constructor(public readonly gpioPin: number) {}

	public initializeAsOutput(): GpioOutput {
		return new PigpioGpioOutput(this.gpioPin);
	}

	public initializeAsInput(config: InputConfig): GpioInput {
		return new PigpioGpioInput(this.gpioPin, config);
	}
}

export interface GpioOutput {
	readonly kind: "GpioOutput";
	setValue(value: boolean): void;
}

class PigpioGpioOutput implements GpioOutput {
	readonly kind = "GpioOutput";
	private readonly gpio: Gpio;

	constructor(gpioPin: number) {
		this.gpio = new Gpio(gpioPin, {
			mode: Gpio.OUTPUT,
		});
	}

	setValue(value: boolean): void {
		this.gpio.digitalWrite(value ? 1 : 0);
	}
}

export interface GpioInput {
	readonly kind: "GpioInput";

	readonly onChange: EventSource<{ value: boolean }, GpioInput>;
}

class PigpioGpioInput implements GpioInput {
	readonly kind = "GpioInput";
	private readonly gpio: Gpio;

	constructor(gpioPin: number, config: InputConfig) {
		const pud = {
			up: Gpio.PUD_UP,
			down: Gpio.PUD_DOWN,
			none: Gpio.PUD_OFF,
		}[config.pullResistor];

		this.gpio = new Gpio(gpioPin, {
			mode: Gpio.OUTPUT,
			pullUpDown: pud,
			edge: Gpio.EITHER_EDGE,
		});

		this.gpio.on("interrupt", level => {
			const value = level > 0;
			this.changeEmitter.emit({ value }, this);
		});
	}

	private readonly changeEmitter = new EventEmitter<
		{ value: boolean },
		GpioInput
	>();
	public readonly onChange = this.changeEmitter.asEvent();
}
