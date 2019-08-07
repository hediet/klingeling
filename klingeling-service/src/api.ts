import {
	contract,
	notificationContract,
	requestContract,
} from "@hediet/typed-json-rpc";
import {
	boolean,
	Integer,
	intersection,
	literal,
	number,
	partial,
	refinement,
	string,
	type,
	TypeOf,
	union,
} from "io-ts";

export const port = 42319;

export const openedDurationInMsType = refinement(
	number,
	x => x >= 100 && x <= 6000
);

const doorOpenedReason = union([
	type({
		type: literal("telegram"),
		id: number,
		username: string,
	}),
	type({
		type: literal("http"),
		username: string,
	}),
]);
export type DoorOpenedReason = TypeOf<typeof doorOpenedReason>;

export const KlingelApi = contract({
	server: {
		openMainDoor: requestContract({
			params: intersection([
				partial({
					openedDurationInMs: openedDurationInMsType,
				}),
				type({
					reason: doorOpenedReason,
				}),
			]),
		}),
		openWgDoor: requestContract({
			params: type({
				reason: doorOpenedReason,
			}),
		}),
		openWgDoorConfig: requestContract({
			params: type({
				openTime: number,
				closeTime: number,
			}),
		}),
		/*
		bellStateChanged: requestContract({
			params: type({
				isRinging: boolean,
				isBroken: boolean,
			}),
		}),*/
	},
	client: {
		mainDoorOpened: notificationContract({
			params: type({
				reason: doorOpenedReason,
			}),
		}),
		wgDoorOpened: notificationContract({
			params: type({
				reason: doorOpenedReason,
			}),
		}),
		bellStateChanged: notificationContract({
			params: type({
				isRinging: boolean,
				time: Integer,
			}),
		}),
	},
});
