const {Telegraf, Composer, Scenes, session} = require('telegraf');
const scrapper = require("./scrapperService")
console.log(scrapper);

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
    return await scrapper.search(ctx);
});

const loadScene = new Composer();
loadScene.on("callback_query", async (ctx) => await scrapper.download(ctx));

const searchAndLoadScene = new Scenes.WizardScene("sceneWizard", startWizard, searchScene, loadScene);
const stage = new Scenes.Stage([searchAndLoadScene]);
bot.use(session());
bot.use(stage.middleware());

bot.command("search", async ctx => await ctx.scene.enter("sceneWizard", {map: new Map()}));
bot.start((ctx) => ctx.reply("Here you can download music from soundcloud.\n\n Use the /search command."));
bot.on("text", ctx => ctx.reply("Use the /search command"));

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));