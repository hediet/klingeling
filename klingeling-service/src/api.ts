import {
	contract,
	requestContract,
	notificationContract,
} from "@hediet/typed-json-rpc";
import { number, union, type, refinement, boolean } from "io-ts";

export const port = 42319;

export const openedDurationInMsType = refinement(
	number,
	x => x >= 100 && x <= 6000
);

export const KlingelApi = contract({
	server: {
		openMainDoor: requestContract({
			params: union([
				type({
					openedDurationInMs: openedDurationInMsType,
				}),
				type({}),
			]),
		}),
		openWgDoor: requestContract({}),
		openWgDoorConfig: requestContract({
			params: type({
				openTime: number,
				closeTime: number,
			}),
		}),
		bellStateChanged: requestContract({
			params: type({
				isRinging: boolean,
				isBroken: boolean,
			}),
		}),
	},
	client: {
		mainDoorOpened: notificationContract({}),
		wgDoorOpened: notificationContract({}),
		bellStateChanged: notificationContract({
			params: type({
				isRinging: boolean,
				isBroken: boolean,
			}),
		}),
	},
});
