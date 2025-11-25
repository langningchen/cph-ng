export type CphSubmitEmpty = {
    empty: true;
};
export type CphSubmitData = {
    empty: false;
    problemName: string;
    url: string;
    sourceCode: string;
    languageId: number;
};
export type CphSubmitResponse = CphSubmitEmpty | CphSubmitData;

export interface CompanionProblem {
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
        id: string;
        size: number;
    };
}
