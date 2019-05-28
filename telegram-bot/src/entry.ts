import { KlingelApi, connectToKlingelService } from "@klingeling/service";
import Telegraf, { ContextMessageUpdate } from "telegraf";
import _TelegrafInlineMenu = require("telegraf-inline-menu");
const TelegrafInlineMenu = (_TelegrafInlineMenu as any) as typeof _TelegrafInlineMenu.default;
import { newConfigDescription } from "@hediet/config";
import { Disposable } from "@hediet/std/disposable";
import { type, string, array } from "io-ts";

const configDescription = newConfigDescription({
	appId: "telegram-bot",
	configFilePath: "data/config.json",
	type: type({
		telegramToken: string,
		admins: array(string),
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
		bot.launch();

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
