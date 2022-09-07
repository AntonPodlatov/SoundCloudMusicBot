const axios = require("axios");
const sckey = require('soundcloud-key-fetch');
let key;
sckey.fetchKey().then(k => {key = k;});

module.exports = class Service {
    constructor() {
           this.key = key;
    }

    async searchTracks(query, limit = 10) {
        return axios.get(`https://api-v2.soundcloud.com/search/tracks?q=` +
            `${encodeURIComponent(query)}` +
            `&client_id=${key}` +
            `&limit=${limit}`);
    }
}
