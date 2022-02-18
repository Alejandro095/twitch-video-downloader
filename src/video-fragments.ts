import fetch from "cross-fetch";

import { log } from "./utils/logger";

import { GetFragmentsResponse } from "./interfaces/fragments-response";
import { VideoDownloadInformation } from "./interfaces/video-download-information";

import { ERRORS } from "./enums/errors";

export class VideoFragmentsFetcher {
    private readonly MANIFIEST_URL_BASE = /^https?:\/\/.*\.net\/.*\//;

    private async _getManifiest(url: string) {
        log(`[VideoFragmentsFetcher] Downloading specific manifiest, url: \n ${url}`);
        return fetch(url).then((response) => response.text());
    }

    async getFragments(manifiest: VideoDownloadInformation): Promise<GetFragmentsResponse> {
        const manifiestUrlBase = (manifiest.url.match(this.MANIFIEST_URL_BASE) || [])[0];

        if (!manifiestUrlBase) throw new Error(ERRORS.URL_MANIFIEST_REQUIRED);

        const streamManifiest = await this._getManifiest(manifiest.url);

        let fragmentsMatched = streamManifiest.matchAll(/#EXTINF.*?\n(.*?\.ts)/g) || [];

        let fragments = Array.from(fragmentsMatched).map((fragment) => [fragment[1], `${manifiestUrlBase}${fragment[1]}`]) as [string, string][];

        log(`[VideoFragmentsFetcher] All fragments found: \n ${JSON.stringify(fragments, undefined, 2)}`);

        return {
            rawContent: streamManifiest,
            fragments: fragments
        };
    }
}
