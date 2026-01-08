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

export interface CphSubmitMsgData extends CphSubmitData {
  clientId: string;
  submissionId: string;
}

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

export interface BatchAvailableMsg {
  type: 'batch-available';
  batchId: string;
  problems: CompanionProblem[];
}

export interface BatchClaimedMsg {
  type: 'batch-claimed';
  batchId: string;
  claimedBy?: string;
}

export interface SubmissionConsumedMsg {
  type: 'submission-consumed';
  clientId: string;
  submissionId: string;
}

export type CompanionMsg =
  | BatchAvailableMsg
  | BatchClaimedMsg
  | SubmissionConsumedMsg;

export interface SubmitMsg {
  type: 'submit';
  data: CphSubmitMsgData;
}

export interface ClaimBatchMsg {
  type: 'claim-batch';
  batchId: string;
  clientId: string;
}

export interface CancelSubmitMsg {
  type: 'cancel-submit';
  submissionId: string;
  clientId: string;
}

export type CompanionClientMsg = SubmitMsg | ClaimBatchMsg | CancelSubmitMsg;
