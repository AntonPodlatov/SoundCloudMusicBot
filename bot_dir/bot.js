const {Telegraf, Composer, Scenes, session} = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const Service = require("./service");
const service = new Service();
const {parseDuration} = require("./utils");
const {Markup} = require("telegraf");
const SoundCloud = require("soundcloud-scraper");
const {isNull} = require("util");
const client = new SoundCloud.Client();
const fs = require("fs");


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
    const mapValue = ctx.wizard.state.data.get(mapKey);

    if (mapKey === "next" || mapKey === "prev") {
        if (typeof mapValue === "undefined") {
            return await ctx.answerCbQuery("Last page!");
        }
        if (isNull(mapValue)) {
            return await ctx.answerCbQuery("First page!");
        }

        const update = await formUpdatedKeyboard(mapValue, ctx);
        await ctx.editMessageText(update.msg);
        await editKeyboard(ctx, update.arr);
        return;
    }

    await ctx.answerCbQuery("preparing the file...");
    await client.getSongInfo(mapValue).then(async song => {
        const title = song.title.replace(/\//g, '\u2215');
        const msg = await ctx.reply("wait about 7 seconds..");
        const stream = await song.downloadHLS();
        const writer = stream.pipe(fs.createWriteStream(`./audio/${title}.mp3`));

        writer.on("finish", async () => {
            try {
                ctx.deleteMessage(msg.message_id);
                await ctx.replyWithAudio({source: `./audio/${title}.mp3`});
                await fs.unlink(`./audio/${title}.mp3`,
                    err => err ? console.log(err) : console.log("removed"));
            } catch (e) {
                console.log(e);
            }
        });
    })
        .catch(console.error);
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
    let soundsButtonsArray = [[], []];
    let soundsList = "";

    return await service.searchTracks(query).then(r => {
        if (r.data.collection.length === 0) {
            ctx.reply("Nothing found.");
            return ctx.wizard.next();
        }

        let i = 0;
        r.data.collection.forEach(sound => {
            const numberRepresented = i + 1;
            soundsList += `${numberRepresented}) ${sound.title} ${parseDuration(sound.full_duration)}\n ${sound.user.permalink}\n\n`
            const key = "song-" + i;
            ctx.wizard.state.data.set(key, sound.permalink_url);

            if (i < 5) {
                soundsButtonsArray[0].push(Markup.button.callback(String(numberRepresented), key));
            } else {
                soundsButtonsArray[1].push(Markup.button.callback(String(numberRepresented), key));
            }
            i++;
        });

        soundsButtonsArray.push([
            Markup.button.callback("prev", "prev"),
            Markup.button.callback("next", "next")]);
        ctx.wizard.state.data.set("prev", null);
        ctx.wizard.state.data.set("next", r.data.next_href);

        const resultsCount = r.data.total_results;
        ctx.reply(`1-10 from ${resultsCount}\n\n` + soundsList, Markup.inlineKeyboard(soundsButtonsArray));
        return ctx.wizard.next();
    }).catch(e => {
        console.log(e)
    });
}

async function formUpdatedKeyboard(url, ctx) {
    let soundsButtonsArray = [[], []];
    let soundsList = "";

    return await service.get(url).then(r => {
        let i = 0;
        r.data.collection.forEach(sound => {
            const numberRepresented = i + 1;
            soundsList += `${numberRepresented}) ${sound.title} ${parseDuration(sound.full_duration)}\n ${sound.user.permalink}\n\n`
            const key = "song-" + i;
            ctx.wizard.state.data.set(key, sound.permalink_url);

            if (i < 5) {
                soundsButtonsArray[0]
                    .push(Markup.button.callback(String(numberRepresented), key));
            } else {
                soundsButtonsArray[1]
                    .push(Markup.button.callback(String(numberRepresented), key));
            }
            i++;
        });

        const thisUrl = new URL(url);
        const offset = thisUrl.searchParams.get("offset");
        let backOffset = offset - 10;

        if (backOffset < 0) {
            ctx.wizard.state.data.set("prev", null);
            ctx.wizard.state.data.set("next", r.data.next_href);
        } else {
            thisUrl.searchParams.set("offset", String(Number(offset) - 10));

            ctx.wizard.state.data.set("prev", thisUrl);
            ctx.wizard.state.data.set("next", r.data.next_href);
        }

        soundsButtonsArray.push([
            Markup.button.callback("prev", "prev"),
            Markup.button.callback("next", "next")]);

        let to = Number(offset) + 10;
        const resultsCount = r.data.total_results;
        if (resultsCount < to) {
            to = resultsCount;
        }

        soundsList = `${offset}-${to} in ${resultsCount}\n\n` + soundsList;
        return {arr: soundsButtonsArray, msg: soundsList};
    }).catch();
}