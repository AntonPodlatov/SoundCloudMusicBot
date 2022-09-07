const {Telegraf, Composer, Scenes, session} = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const Service = require("./service");
const service = new Service();
const {parseDuration} = require("./utils");
const {Markup} = require("telegraf");
const {Downloader} = require("soundcloud-scraper");
const SoundCloud = require("soundcloud-scraper");
const client = new SoundCloud.Client();

const startWizard = new Composer();
startWizard.on("text", async (ctx) => {
    ctx.wizard.state.data = new Map();
    console.log(ctx.update.message.from);

    await ctx.reply("Enter search query: ");
    return ctx.wizard.next();
});

const searchScene = new Composer();
searchScene.on("text", async (ctx) => {
    await formKeyboardAndReply(ctx);
});

const loadScene = new Composer();
loadScene.on("callback_query", async (ctx) => {
    await ctx.answerCbQuery("preparing the file for transfer, it will take a few seconds..");
    const mapKey = ctx.update.callback_query.data;

    if (mapKey === "next") {
        console.log("next");
        await editKeyboard(ctx, [[Markup.button.callback("👍", "123"), Markup.button.callback("❤", "234")]]);
        return;
    }
    if (mapKey === "prev") {
        console.log("prev");
        const keyboard = [];

        await editKeyboard(ctx, [[Markup.button.callback("👍", "123"), Markup.button.callback("❤", "234")]]);
        return;
    }

    await client.getSongInfo(ctx.wizard.state.data.get(mapKey))
        .then(async song => {
            ctx.reply(song.title);
            console.log(song.title);
        });
});

const searchAndLoadScene = new Scenes.WizardScene("sceneWizard", startWizard, searchScene, loadScene);
const stage = new Scenes.Stage([searchAndLoadScene]);
bot.use(session());
bot.use(stage.middleware());


bot.command("search", async ctx => {
    await ctx.scene.enter("sceneWizard");
});

bot.start((ctx) => ctx.reply("Here you can download music from soundcloud.\n\n Use the /search command."));
bot.on("text", ctx => ctx.reply("Use the /search command."));

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


async function editKeyboard(ctx, markupArray) {
    await ctx.telegram.editMessageReplyMarkup(
        ctx.update.callback_query.message.chat.id,
        ctx.update.callback_query.message.message_id,
        undefined,
        {inline_keyboard: markupArray});
}

async function formKeyboardAndReply(ctx) {
    const query = ctx.update.message.text;
    let soundsButtonsArray = [];

    return await service.searchTracks(query).then(r => {
        if (r.data.collection.length === 0) {
            ctx.reply("Nothing found.");
            return ctx.wizard.next();
        }

        let i = 0;
        r.data.collection.forEach(sound => {
            const key = "song-" + i;
            ctx.wizard.state.data.set(key, sound.permalink_url);
            soundsButtonsArray
                .push([Markup.button
                    .callback(`${sound.user.permalink}  ${sound.title} ${parseDuration(sound.full_duration)}`, key)]);
            i++;
        });

        const resultsCount = r.data.total_results;
        const pagesCount = Math.ceil(resultsCount / 10);
        soundsButtonsArray.push([
            Markup.button.callback("prev", "prev"),
            Markup.button.callback("next", "next")]);
        ctx.wizard.state.data.set("prev", null);
        ctx.wizard.state.data.set("next", r.data.next_href);

        ctx.reply(`Results: ${resultsCount} | pages: ${pagesCount}`, Markup.inlineKeyboard(soundsButtonsArray));
        return ctx.wizard.next();
    }).catch();
}