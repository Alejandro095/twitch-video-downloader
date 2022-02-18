export function parseURL(url: string): string {
    const REGEX = /(http(s)?:\/\/)?(www.)?twitch.tv\/videos\/(\d+)/;
    const search = url.match(REGEX);

    let result = "";

    if (search) {
        result = search[4];
    }

    return result;
}
