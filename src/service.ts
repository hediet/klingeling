import { init } from "raspi";
import { DigitalOutput, PULL_UP } from "raspi-gpio";
import { Barrier } from "@hediet/std/synchronization";
import { wait } from "@hediet/std/timer";

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

    public async openMainDoor(timeMs: number): Promise<void> {
        const s = await this.initializedBarrier.onUnlocked;
        await s.openMainDoor(timeMs);
    }

    public async openWgDoor(): Promise<void> {
        const s = await this.initializedBarrier.onUnlocked;
        await s.openWgDoor();
    }
}

class InitializedService {
    private readonly mainDoorRelayOutput = new DigitalOutput({
        pullResistor: PULL_UP,
        pin: "GPIO3"
    });

    private mainDoorCount = 0;
    public async openMainDoor(timeMs: number): Promise<void> {
        if (!(timeMs >= 0 && timeMs <= 6 * 1000)) {
            throw new Error("Invalid time interval!");
        }
        
        this.mainDoorCount++;
        try {
            if (this.mainDoorCount === 1) {
                this.mainDoorRelayOutput.write(0);
            }
            await wait(timeMs);
        } finally {
            this.mainDoorCount--;

            if (this.mainDoorCount === 0) {
                this.mainDoorRelayOutput.write(1);
            }
        }
    }

    public async openWgDoor(): Promise<void> {}
}
