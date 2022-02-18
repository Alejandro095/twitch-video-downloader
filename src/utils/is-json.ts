export function parseIfIsJSON<T>(text: string): T | null {
    try {
        const data: T = JSON.parse(text);

        return data;
    } catch (error) {
        return null;
    }
}
