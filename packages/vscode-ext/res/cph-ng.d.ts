interface CompanionProblem {
    name: string;
    group: string;
    url: string;
    interactive: boolean;
    memoryLimit: number;
    timeLimit: number;
    tests: {
        input: string;
        output: string;
    }[];
    testType: 'single' | 'multiNumber';
    input: {
        type: 'stdin' | 'file' | 'regex';
        fileName?: string;
        pattern?: string;
    };
    output: {
        type: 'stdout' | 'file';
        fileName?: string;
    };
    languages: {
        java: {
            mainClass: string;
            taskClass: string;
        };
    };
    batch: {
        id: BatchId;
        size: number;
    };
}

interface WorkspaceFolderContext {
    index: number;
    name: string;
    path: string;
}

interface UI {
    chooseFolder(title?: string): Promise<string | undefined>;
    chooseItem(items: string[], placeHolder?: string): Promise<string | undefined>;
    input(prompt?: string, value?: string): Promise<string | undefined>;
}

interface Utils {
    sanitize(name: string): string;
}

interface Logger {
    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}

declare const problems: CompanionProblem[];
declare const workspaceFolders: WorkspaceFolderContext[];
declare const ui: UI;
declare const utils: Utils;
declare const logger: Logger;

declare const path: typeof import("path");
declare const fs: {
    existsSync(path: string): boolean;
};
