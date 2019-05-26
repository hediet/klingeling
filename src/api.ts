import {
    contract,
    requestContract,
    notificationContract
} from "@hediet/typed-json-rpc";

export const KlingelApi = contract({
    server: {
        openMainDoor: requestContract({}),
        openWgDoor: requestContract({}),
        notifyBellHasRung: requestContract({})
    },
    client: {
        mainDoorOpened: notificationContract({}),
        wgDoorOpened: notificationContract({}),
        bellRinged: notificationContract({})
    }
});
