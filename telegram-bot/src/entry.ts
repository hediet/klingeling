import { KlingelApi, connectToKlingelService } from "@klingeling/service";
import Telegraf, { ContextMessageUpdate } from "telegraf";
import _TelegrafInlineMenu = require("telegraf-inline-menu");
const TelegrafInlineMenu = (_TelegrafInlineMenu as any) as typeof _TelegrafInlineMenu.default;
import { newConfigDescription } from "@hediet/config";
import { Disposable } from "@hediet/std/disposable";
import { type, string, array, number, union } from "io-ts";
import * as t from "io-ts";
import { promises as fs } from "fs";
import { promisify } from "util";
import { execFile as _execFile } from "child_process";
import _glob from "glob";
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
	private readonly klingelService: Promise<
		typeof KlingelApi.TServerInterface & Disposable
	>;

	private bot: Telegraf<ContextMessageUpdate>;

	constructor() {
		this.bot = new Telegraf(config.telegramToken);
		this.bot.use((ctx, next) => {
			if (
				next &&
				ctx.from &&
				ctx.chat &&
				(config.admins.includes(String(ctx.from.id)) ||
					config.admins.includes(String(ctx.chat.id)))
			) {
				if (ctx.chat) {
					this.log("chat id", ctx.from.id, "=", ctx.chat.id);
					// adminChats.add(String(ctx.chat.id))
				}
				(next as any)(ctx);
			} else {
				this.log(
					"msg from unknown user",
					ctx.updateType,
					ctx.message && ctx.message.text,
					ctx.from,
					ctx.chat && ctx.chat!.id
				);
			}
		});

		const menu = new TelegrafInlineMenu(
			ctx => `Hey ${ctx.from!.first_name}!`
		);
		menu.setCommand("start");
		menu.simpleButton("Hold the dooor!", "a", {
			doFunc: ctx => this.open(ctx, "main"),
		});
		this.bot.use(menu.init());
		this.bot.on(
			"callback_query",
			(
				ctx: ContextMessageUpdate,
				next?: (ctx: ContextMessageUpdate) => any
			) => {
				const data = (ctx.update.callback_query as any).data;
				if (data === "openMainDoor") {
					this.open(ctx, "main");
				} else if (data === "openWgDoor") {
					this.open(ctx, "wg");
				}
				next!(ctx);
			}
		);
		this.bot.command("/openMainDoor", async ctx => {
			await this.open(ctx, "main");
		});
		this.bot.command("/openWgDoor", async ctx => {
			await this.open(ctx, "wg");
		});
		this.bot.command("/video", async ctx => {
			const [_, seconds = 10] = ctx.message!.text!.split(/\s+/g);
			await this.sendVideo(ctx.chat!.id, +seconds);
		});

		this.bot.launch();
		this.log("Bot active.");

		this.klingelService = connectToKlingelService({
			bellStateChanged: async args => {
				this.log("door bell state changed: " + JSON.stringify(args));
				for (const chat of config.admins) {
					if (args.isRinging) {
						await this.sendButtons(chat, "The doorbell just rang!");
						this.sendVideo(chat);
					} else if (args.isBroken) {
						this.bot.telegram.sendMessage(
							chat,
							"The doorbell just broke! :("
						);
					}
				}
			},
		});
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
			`Here's the last ${wantSegmentCount *
				c.chunkLengthSeconds} seconds of video:`
		);
		const fnames = [c.initSegment, ...chunkNames];
		this.log("chunks", fnames);

		/*const file = Buffer.concat(await Promise.all([
			fs.readFile(c.initSegment),
			...chunkNames.map(c => fs.readFile(c)),
		]));*/
		// ctx.reply("Last ")
		const tmpVidFname = "/tmp/out-vid.mp4";
		const { stdout, stderr } = await execFile(
			"ffmpeg",
			[
				"-i",
				"concat:" + fnames.join("|"),
				"-f",
				"lavfi", // add silent audio track to prevent gif
				"-i",
				"anullsrc",
				"-shortest", // anullsrc is infinite
				"-c:v",
				"copy",
				"-f",
				"mp4",
				"-y",
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

	private async open(ctx: ContextMessageUpdate, door: "main" | "wg") {
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
		const klingelService = await this.klingelService;
		ctx.replyWithMarkdown("Opening door...");
		if (door === "main") {
			await klingelService.openMainDoor();
		} else {
			await klingelService.openWgDoor();
		}
	}
}

new Main();
