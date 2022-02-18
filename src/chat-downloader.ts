import fetch from "cross-fetch";

import { CommentsPage } from "./interfaces/comment";
import { log } from "./utils/logger";

export class ChatDownloader {
    private _vodID: string;
    private _clientID: string;

    private _allComments: CommentsPage[] = [];

    constructor(vodID: string, clientID: string) {
        this._vodID = vodID;
        this._clientID = clientID;
    }

    private async _api(cursor?: string) {
        const headers = {
            "Client-ID": this._clientID
        };

        return fetch(this._getEndpoint(cursor), { headers });
    }

    private _getEndpoint(cursor: string = "") {
        return `https://api.twitch.tv/v5/videos/${this._vodID}/comments?cursor=${cursor}`;
    }

    public async download() {
        let cursor = undefined;

        log(`[ChatDownloader] Downloading chat for ${this._vodID}`);

        do {
            const response = (await this._api(cursor).then((resp) => resp.json())) as any;

            if (response.comments.length) {
                this._allComments.push(response);
                log(`[ChatDownloader] ${response.comments.length} comments downloaded, cursor ${cursor || "initial"}.`);
                cursor = response._next;
            } else {
                cursor = undefined;
            }
        } while (cursor);
        log(`[ChatDownloader] Chat downloaded.`);
        return {
            vodID: this._vodID,
            content: this._allComments
        };
    }
}
