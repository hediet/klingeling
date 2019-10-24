import { newConfigDescription } from "@hediet/config";
import { wait } from "@hediet/std/timer";
import { connectToKlingelService, KlingelApi } from "@klingeling/service";
import { DoorOpenedReason } from "@klingeling/service/dist/api";
import { execFile as _execFile } from "child_process";
import _glob from "glob";
import * as t from "io-ts";
import { array, number, string, type, union } from "io-ts";
import Telegraf, { ContextMessageUpdate } from "telegraf";
import { promisify } from "util";

// typings of this lib are wrong
import _TelegrafInlineMenu = require("telegraf-inline-menu");
const TelegrafInlineMenu = (_TelegrafInlineMenu as any) as typeof _TelegrafInlineMenu.default;

const glob = promisify(_glob);
const execFile = promisify(_execFile);

const configDescription = newConfigDescription({
	appId: "telegram-bot",
	configFilePath: "data/config.json",
	type: type({
		telegramToken: string,
		admins: array(string),
		videoFeed: union([
			t.null,
			type({
				initSegment: string,
				chunkSegmentGlob: string,
				chunkLengthSeconds: number,
			}),
		]),
	}),
});
const config = configDescription.load();

class Main {
	private klingelService:
		| typeof KlingelApi.TServerInterface
		| undefined = undefined;

	private bot: Telegraf<ContextMessageUpdate>;

	constructor() {
		this.keepAliveConnection();

		this.bot = new Telegraf(config.telegramToken);
		this.bot.use(this.authenticate.bind(this));

		this.bot.command("/start", async ctx => {
			if (!ctx.chat) return;
			await this.sendButtons(ctx.chat.id, "Hello!");
		});
		this.bot.command("/openMainDoor", async ctx => {
			await this.openDoor(ctx, "main");
		});
		this.bot.command("/openWgDoor", async ctx => {
			await this.openDoor(ctx, "wg");
		});
		this.bot.command("/video", async ctx => {
			const [_, seconds = 10] = ctx.message!.text!.split(/\s+/g);
			await this.sendVideo(ctx.chat!.id, +seconds);
		});

		this.bot.on(
			"callback_query",
			(
				ctx: ContextMessageUpdate,
				next?: (ctx: ContextMessageUpdate) => any
			) => {
				const data = (ctx.update.callback_query as any).data;
				if (data === "openMainDoor") {
					this.openDoor(ctx, "main");
				} else if (data === "openWgDoor") {
					this.openDoor(ctx, "wg");
				}
				next!(ctx);
			}
		);

		this.bot.launch();
		this.log("Bot active.");
	}

	private async reportOpened(type: "wg" | "main", reason: DoorOpenedReason) {
		for (const chat of config.admins) {
			this.bot.telegram.sendMessage(
				chat,
				`Opening ${
					{ wg: "WG", main: "Main" }[type]
				} door... (requested by ${reason.type}: ${reason.username})`,
				{ disable_notification: true }
			);
		}
	}

	private async keepAliveConnection() {
		while (true) {
			try {
				console.log("Connecting...");
				const server = await connectToKlingelService({
					bellStateChanged: async args => {
						this.log(
							"door bell state changed: " + JSON.stringify(args)
						);
						for (const chat of config.admins) {
							if (args.isRinging) {
								await this.sendButtons(
									chat,
									"The doorbell just rang!"
								);
								this.sendVideo(chat);
							}
						}
					},
					wgDoorOpened: async ({ reason }) =>
						this.reportOpened("wg", reason),
					mainDoorOpened: async ({ reason }) =>
						this.reportOpened("main", reason),
				});
				this.klingelService = server;
				console.log("Connected.");
				await server.stream.onClosed;
				console.log("Disconnected.");
			} catch (e) {
				console.error("Error while connecting: ", e);
			}
			console.log("Waiting to reconnect.");
			await wait(2000);
		}
	}

	private authenticate(
		ctx: ContextMessageUpdate,
		next?: (ctx: ContextMessageUpdate) => void
	) {
		if (
			next &&
			ctx.from &&
			ctx.chat &&
			(config.admins.includes(String(ctx.from.id)) ||
				config.admins.includes(String(ctx.chat.id)))
		) {
			if (ctx.chat) {
				this.log("chat id", ctx.from.id, "=", ctx.chat.id);
			}
			next(ctx);
		} else {
			this.log(
				"msg from unknown user",
				ctx.updateType,
				ctx.message && ctx.message.text,
				ctx.from,
				ctx.chat && ctx.chat!.id
			);
		}
	}

	private log(...args: any[]) {
		console.log(new Date(), ...args);
	}

	private async sendButtons(chatId: string | number, text: string) {
		this.bot.telegram.sendMessage(chatId, text, {
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "Open main door",
							callback_data: "openMainDoor",
						},
						{
							text: "Open room door",
							callback_data: "openWgDoor",
						},
					],
				],
			},
		});
	}

	private async sendVideo(chatId: string | number, seconds: number = 10) {
		const c = config.videoFeed;
		if (c === null) {
			this.bot.telegram.sendMessage(chatId, "video config not set");
			return;
		}
		const allChunkNames = await glob(c.chunkSegmentGlob);
		const wantSegmentCount = Math.ceil(seconds / c.chunkLengthSeconds);
		const chunkNames = allChunkNames
			.sort((a, b) => a.localeCompare(b))
			.slice(-wantSegmentCount);

		this.bot.telegram.sendMessage(
			chatId,
			`Here's the last ${chunkNames.length *
				c.chunkLengthSeconds} seconds of video:`,
			{ disable_notification: true }
		);

		const fnames = [c.initSegment, ...chunkNames];
		this.log("chunks", fnames);

		// directly reading and concatenating MP4 DASH chunks is works, but it causes "wrong" timestamps that telegram does not like
		/* const file = Buffer.concat(await Promise.all([
			fs.readFile(c.initSegment),
			...chunkNames.map(c => fs.readFile(c)),
		])); */

		// writing to stdout has buffer size limitations

		const tmpVidFname = "/tmp/out-vid.mp4"; // todo: don't hardcode
		const { stdout, stderr } = await execFile(
			"ffmpeg",
			[
				"-i",
				"concat:" + fnames.join("|"),
				"-f",
				"lavfi", // add silent audio track to prevent telegram from converting it to a "gif"
				"-i",
				"anullsrc",
				"-shortest", // anullsrc is infinite
				"-c:v",
				"copy",
				"-f",
				"mp4",
				"-y", // overwrite output file
				tmpVidFname,
			]
			/*{
				encoding: "buffer",
				maxBuffer: 20 * 1000 * 1000,
			}*/
		);
		//this.log("video size", stdout.byteLength);

		await this.bot.telegram.sendVideo(chatId, { source: tmpVidFname });
	}

	private async openDoor(ctx: ContextMessageUpdate, door: "main" | "wg") {
		if (!ctx.from) {
			this.log("what?");
			return;
		}
		this.log(
			"openDoor",
			ctx.from.id,
			ctx.from.first_name,
			ctx.from.last_name
		);
		if (!this.klingelService) {
			return;
		}

		const reason = {
			type: "telegram",
			id: ctx.from.id,
			username: ctx.from.first_name,
		} as const;
		if (door === "main") {
			await this.klingelService.openMainDoor({ reason });
		} else {
			await this.klingelService.openWgDoor({ reason });
		}
	}
}

new Main();
