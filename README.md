# klingeling

Automatic door bell detection and door opener.

## Components

-   [klingeling-service](klingeling-service/) controls the door openers and provides a WebSocket api with JSON-RPC calls and events.
-   [http-server](http-server/src/entry.ts) provides a REST api to control it over the internet
-   [ringing-notifier](ringing-notifier/src/entry.ts) detects the door bell ringing
-   [telegram-bot](telegram-bot/src/entry.ts) allows controlling everything over a group chat
