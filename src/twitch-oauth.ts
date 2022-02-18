import fetch from "cross-fetch";

export interface LoginOptions {
    authy_token?: string;
    client_id?: string;
    remember_me?: boolean;
}

interface OAuthPayload {
    username: string;
    password: string;
    authy_token?: string;
    client_id: string;
    remember_me: boolean;
    undelete_user: boolean;
    captcha?: {
        proof?: string;
        arkose?: string;
    };
}

export class TwitchOAuth {
    private readonly PASSPORT_ENDPOINT: string = "https://passport.twitch.tv/login";

    public async login(username: string, password: string, options?: LoginOptions) {
        const payload: OAuthPayload = {
            username: username,
            password: password,
            authy_token: options?.authy_token,
            client_id: options?.client_id || "kimne78kx3ncx6brgo4mv6wki5h1ko",
            remember_me: options?.remember_me || true,
            undelete_user: false
        };

        const passportFetchOptions: RequestInit = {
            method: "POST",
            body: JSON.stringify(payload)
        };

        return fetch(this.PASSPORT_ENDPOINT, passportFetchOptions)
            .then((response) => response.json())
            .then((response) => {
                if (response && response.error_code) throw new Error(`[TwitchOAuth] Twitch server say: ${response.error}`);

                if (!response.access_token) throw new Error(`[TwitchOAuth] Unknown error.`);

                return response.access_token;
            });
    }
}
