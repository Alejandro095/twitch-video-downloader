import fetch from "cross-fetch";

import { log } from "./utils/logger";
import { parseIfIsJSON } from "./utils/is-json";

import { AccessToken, PlaybackAccessToken } from "./interfaces/access-token";
import { ManifiestResponseError } from "./interfaces/manifiest-response";
import { VideoDownloadInformation } from "./interfaces/video-download-information";

import { ERRORS } from "./enums/errors";
import { TWITCH_API_ERROR } from "./enums/twitch-api";

export class VideoManifiest {
    private readonly _vodID: string;
    private readonly _clientID: string;
    private readonly _oAuthToken: string;

    private readonly GRAPHQL_ENDPOINT: string = "https://gql.twitch.tv/gql";

    constructor(vodID: string | number, clientID: string | number, oAuthToken: string | number = "") {
        this._vodID = String(vodID);
        this._clientID = String(clientID);
        this._oAuthToken = String(oAuthToken);
    }

    private _getPlaybackAccessToken(): Promise<PlaybackAccessToken> {
        const graphqlQuery = {
            operationName: "PlaybackAccessToken_Template",
            query: 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: "web", playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}',
            variables: {
                isLive: false,
                login: "",
                isVod: true,
                vodID: this._vodID,
                playerType: "site"
            }
        };

        const graphqlFentchOptions: RequestInit = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "OAuth " + this._oAuthToken,
                "Client-ID": this._clientID
            },
            body: JSON.stringify(graphqlQuery)
        };

        log(`[VideoManifiest] Generating access token.`);
        return fetch(this.GRAPHQL_ENDPOINT, graphqlFentchOptions).then((response) => response.json()) as Promise<PlaybackAccessToken>;
    }

    private _getVideoManifiest(signature: string, accessToken: AccessToken): Promise<string> {
        log(
            `[VideoManifiest] Fetching video manifiest, with parameters: \n Signature: ${signature}, \n Access Token: ${JSON.stringify(
                accessToken,
                undefined,
                4
            )}.`
        );

        const MANIFIEST_ENPOINT = `https://usher.ttvnw.net/vod/${this._vodID}.m3u8?allow_source=true&player_backend=mediaplayer&playlist_include_framerate=true&reassignments_supported=true&sig=${signature}&supported_codecs=avc1&token=${accessToken}&cdm=wv&player_version=1.7.0`;

        return fetch(MANIFIEST_ENPOINT).then((response) => response.text());
    }

    private _parseVideoManifiest(manifiest: string) {
        const isJsonResponse = parseIfIsJSON<ManifiestResponseError[]>(manifiest);
        if (isJsonResponse?.length && isJsonResponse[0].error_code == TWITCH_API_ERROR.VOD_MANIFIEST_RESTRICTED) {
            log(
                `[VideoManifiest] Can´t get video maifiest, you probably don't have permission to view the video. Pass your OAuth token from twitch to VideoDownloader options to try get the video.`
            );

            throw new Error(ERRORS.MANIFIEST_IS_RESTRICRED);
        }

        const parsedPlaylist = [];
        const lines = manifiest.split("\n");
        for (let i = 4; i < lines.length; i += 3) {
            parsedPlaylist.push({
                quality: lines[i - 2].split('NAME="')[1].split('"')[0],
                resolution: lines[i - 1].indexOf("RESOLUTION") != -1 ? lines[i - 1].split("RESOLUTION=")[1].split(",")[0] : null,
                url: lines[i]
            });
        }

        log(`[VideoManifiest] Resolutions found`);
        log(JSON.stringify(parsedPlaylist, undefined, 2));

        return parsedPlaylist;
    }

    public getVideoResolutions(): Promise<VideoDownloadInformation[]> {
        return this._getPlaybackAccessToken()
            .then((response) => {
                const signature = response?.data?.videoPlaybackAccessToken?.signature || null;
                const token = response?.data?.videoPlaybackAccessToken?.value || null;

                if (!signature || !token) {
                    log(`[VideoManifiest] Can´t generante access token, with clientId ${this._clientID}.`);

                    throw new Error(ERRORS.CANT_GENERATE_ACCESS_TOKEN);
                }

                return this._getVideoManifiest(signature, token);
            })
            .then(this._parseVideoManifiest.bind(this)) as Promise<VideoDownloadInformation[]>;
    }
}
