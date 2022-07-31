const {Markup} = require("telegraf");
const SoundCloud = require("soundcloud-scraper");
const fs = require("fs");
const client = new SoundCloud.Client();

module.exports = {
    search: async function search(ctx) {
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
    },

    download: async function download(ctx) {
        await ctx.answerCbQuery("preparing the file for transfer, it will take a few seconds..");
        const mapKey = ctx.update.callback_query.data;
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
    }
}