module.exports = {
    parseDuration: function parseDuration(duration) {
        const secondsCount = duration / 1000;
        const minutes = Math.floor(secondsCount / 60);
        let seconds = Math.floor(secondsCount % 60);

        if (seconds < 10) {
            seconds = "0" + seconds;
        }

        return minutes + ":" + seconds;
    }
}