import { existsSync, mkdirSync } from "fs";

export function ensureDirectoryExists(path: string) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}
