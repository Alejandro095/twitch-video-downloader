export interface Authorization {
    forbidden: boolean;
    reason: string;
}

export interface Chansub {
    restricted_bitrates: any[];
}

export interface AccessToken {
    authorization: Authorization;
    chansub: Chansub;
    device_id?: any;
    expires: number;
    https_required: boolean;
    privileged: boolean;
    user_id?: any;
    version: number;
    vod_id: number;
}

export interface PlaybackAccessToken {
    data: {
        videoPlaybackAccessToken: {
            value: AccessToken;
            signature: string;
            __typename: string;
        };
    };
    extenesion: {
        durationMilliseconds: number;
        operationName: string;
        requestID: string;
    };
}
