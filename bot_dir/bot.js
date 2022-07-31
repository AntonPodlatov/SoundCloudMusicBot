const SoundCloud = require("soundcloud-scraper");
const client = new SoundCloud.Client();
const {Telegraf, Markup, Composer, Scenes, session} = require('telegraf');
const fs = require("fs");

require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const startWizard = new Composer();
startWizard.on("text", async (ctx) => {
    console.log(ctx.wizard.state);
    ctx.wizard.state.data = new Map();
    await ctx.reply("Enter search query: ");
    return ctx.wizard.next();
});

const searchScene = new Composer();
searchScene.on("text", async (ctx) => {
    let soundsButtonsArray = [];
    await client.search(ctx.message.text, "track").then(res => {
        let i = 0;
        res.forEach(s => {
            const mapKey = "song-" + i;
            ctx.wizard.state.data.set(mapKey, s.url);
            soundsButtonsArray.push([Markup.button.callback(s.artist + "  " + s.name + " ", mapKey)]);
            i++;
        });

        if (res.length !== 0) {
            ctx.reply("Over time, there will be pagination, but for now the first ten results.", Markup.inlineKeyboard(soundsButtonsArray));
        } else {
            ctx.reply("Nothing found.");
        }
    });
    return ctx.wizard.next();
});


const loadScene = new Composer();
loadScene.on("callback_query", async (ctx) => {
    await ctx.answerCbQuery("preparing the file for transfer, it will take a few seconds..");
    const mapKey = ctx.update.callback_query.data;
    console.log(ctx.wizard.state.data.get(mapKey));

    await client.getSongInfo(ctx.wizard.state.data.get(mapKey))
        .then(async song => {
            const stream = await song.downloadHLS();
            const writer = await stream.pipe(fs.createWriteStream(`./songs/${song.title}.mp3`));
            await writer.on("finish", async () => {

                try {
                    await ctx.replyWithAudio({source: `./songs/${song.title}.mp3`});
                    await fs.unlink(`./songs/${song.title}.mp3`,
                        err => err ? console.log(err) : console.log("removed"));
                } catch (e) {
                    console.log(e);
                }
            });
        }).catch(console.error);
});

const searchAndLoadScene = new Scenes.WizardScene("sceneWizard", startWizard, searchScene, loadScene);
const stage = new Scenes.Stage([searchAndLoadScene]);
bot.use(session());
bot.use(stage.middleware());

bot.command("search", async ctx => {
    await ctx.scene.enter("sceneWizard", {map: new Map()});
});

bot.start((ctx) => {
    ctx.reply("Here you can download music from soundcloud.\n\n Use the /search command.")
});
bot.on("text", ctx => ctx.reply("Use the /search command"));

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));