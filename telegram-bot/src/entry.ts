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

	constructor() {
		const bot = new Telegraf(config.telegramToken);
		const menu = new TelegrafInlineMenu(
			ctx => `Hey ${ctx.from!.first_name}!`
		);
		menu.setCommand("start");
		menu.simpleButton("Hold the dooor!", "a", {
			doFunc: ctx => this.open(ctx),
		});

		bot.use((ctx, next) => {
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
		bot.use(menu.init());

		bot.command("/video", async ctx => {
			const [_, seconds = 10] = ctx.message!.text!.split(/\s+/g);
			const c = config.videoFeed;
			if (c === null) {
				ctx.reply("video config not set");
				return;
			}
			const allChunkNames = await glob(c.chunkSegmentGlob);
			const wantSegmentCount = Math.ceil(+seconds / c.chunkLengthSeconds);
			const chunkNames = allChunkNames
				.sort((a, b) => a.localeCompare(b))
				.slice(-wantSegmentCount);

			ctx.reply(
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

			ctx.replyWithVideo({ source: tmpVidFname });
		});
		bot.launch();
		this.log("Bot active.");

		this.klingelService = connectToKlingelService({
			bellRinged: () => {
				this.log("got doorbell ring");
				for (const chat of config.admins) {
					bot.telegram.sendMessage(chat, "The doorbell just rang!");
				}
			},
		});
	}

	private log(...args: any[]) {
		console.log(new Date(), ...args);
	}

	private async open(ctx: ContextMessageUpdate) {
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
		await klingelService.openMainDoor();

		ctx.replyWithMarkdown("Opening door...");
	}
}

new Main();
