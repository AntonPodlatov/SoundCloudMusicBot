const {Telegraf, Composer, Scenes, session} = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const Service = require("./service");
const service = new Service();
const {parseDuration} = require("./utils");
const {Markup} = require("telegraf");
const SoundCloud = require("soundcloud-scraper");
const {isNull} = require("util");
const Url = require("url");
const client = new SoundCloud.Client();
const url = require ('node:url');


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
    const mapKey = ctx.update.callback_query.data;
    const url = ctx.wizard.state.data.get(mapKey);

    if (mapKey === "next") {
        if (url === undefined) {
            return await ctx.answerCbQuery("this is last page");
        }
        const markupArray = await formKeyboardUpdated(url, ctx);
        console.log(url);
        await editKeyboard(ctx, markupArray);
        return;
    }

    if (mapKey === "prev") {
        if (isNull(url)) {
            return await ctx.answerCbQuery("this is first page");
        }
        const markupArray = await formKeyboardUpdated(url, ctx);
        console.log(url);
        // await editKeyboard(ctx, markupArray);
    }

    // await ctx.answerCbQuery("preparing the file for transfer, it will take a few seconds..");
    //  await client.getSongInfo(ctx.wizard.state.data.get(mapKey)).then(async song => {ctx.reply(song.title);console.log(song.title);});
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

async function formKeyboardUpdated(url, ctx) {
    let soundsButtonsArray = [];
    await service.next(url).then(r => {
        let i = 0;
        r.data.collection.forEach(sound => {
            const key = "song-" + i;
            ctx.wizard.state.data.set(key, sound.permalink_url);
            soundsButtonsArray.push([Markup.button
                .callback(`${sound.user.permalink}  ${sound.title} ${parseDuration(sound.full_duration)}`, key)]);
            i++;
        });

        soundsButtonsArray.push([
            Markup.button.callback("prev", "prev"),
            Markup.button.callback("next", "next")]);

        const nextUrl = new URL(url);
        console.log(nextUrl.searchParams.get("offset"));
        //console.log(nextUrl);

        ctx.wizard.state.data.set("prev", url);
        ctx.wizard.state.data.set("next", r.data.next_href);
    }).catch();
    return soundsButtonsArray;
}