// Copyright (C) 2026 Langning Chen
//
// This file is part of cph-ng.
//
// cph-ng is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// cph-ng is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with cph-ng.  If not, see <https://www.gnu.org/licenses/>.

import type {
  ILanguageEnv,
  LanguageExecutable,
  ToolchainInfo,
  ToolchainItem,
  WebviewHostEvent,
  WebviewMsg,
} from '@cph-ng/core';
import { produce } from 'immer';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';

type OobeState = {
  languages?: Record<
    string,
    {
      compilers?: ToolchainInfo;
      interpreters?: ToolchainInfo;
      configs: ILanguageEnv;
    }
  >;
};

const OobeContext = createContext<
  | {
      state: OobeState;
      getLanguageList: () => void;
      getLanguageInfo: (language: string, executable: LanguageExecutable) => void;
      checkLanguageInfo: (
        language: string,
        executable: LanguageExecutable,
        path: string,
      ) => Promise<ToolchainItem | null>;
      updateSettings: (language: string, configs: ILanguageEnv) => void;
      oobeDone: () => void;
    }
  | undefined
>(undefined);

const OobeReducer = (state: OobeState, data: WebviewHostEvent | WebviewMsg): OobeState => {
  return produce(state, (draft) => {
    if (data.type === 'languageList') {
      for (const [lang, configs] of Object.entries(data.payload)) {
        if (!draft.languages) draft.languages = {};
        if (!draft.languages[lang]) draft.languages[lang] = { configs };
      }
    }
    if (data.type === 'languageInfo') {
      if (!draft.languages?.[data.language]) return;
      if (data.compilers) draft.languages[data.language].compilers = data.compilers;
      if (data.interpreters) draft.languages[data.language].interpreters = data.interpreters;
    }
    if (data.type === 'getLanguageList') draft.languages = {};
    if (data.type === 'getLanguageInfo') {
      if (!draft.languages?.[data.language]) return;
      if (data.executable === 'compiler') delete draft.languages[data.language].compilers;
      if (data.executable === 'interpreter') delete draft.languages[data.language].interpreters;
    }
  });
};

export const OobeProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(OobeReducer, {});

  const pendingRequests = useRef<Map<string, (value: ToolchainItem | null) => void>>(new Map());

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent<WebviewHostEvent>) => {
      if (data.type === 'languageList' || data.type === 'languageInfo') dispatch(data);
      if (data.type === 'checkedLanguageInfo') {
        const requestKey = `${data.language}:${data.executable}:${data.path}`;
        const resolve = pendingRequests.current.get(requestKey);
        if (typeof resolve === 'function') {
          resolve(data.item);
          pendingRequests.current.delete(requestKey);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'init' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendMsg = useCallback((msg: WebviewMsg) => {
    dispatch(msg);
    vscode.postMessage(msg);
  }, []);
  const getLanguageList = useCallback(
    () => sendMsg({ type: 'getLanguageList' } satisfies WebviewMsg),
    [sendMsg],
  );
  const getLanguageInfo = useCallback(
    (language: string, executable: LanguageExecutable) =>
      sendMsg({ type: 'getLanguageInfo', language, executable } satisfies WebviewMsg),
    [sendMsg],
  );
  const checkLanguageInfo = useCallback(
    (language: string, executable: LanguageExecutable, path: string) => {
      return new Promise<ToolchainItem | null>((resolve) => {
        pendingRequests.current.set(`${language}:${executable}:${path}`, resolve);
        vscode.postMessage({
          type: 'checkLanguageInfo',
          language,
          executable,
          path,
        } satisfies WebviewMsg);
      });
    },
    [],
  );
  const updateSettings = useCallback((language: string, configs: ILanguageEnv) => {
    dispatch({ type: 'updateSettings', language, payload: configs } satisfies WebviewMsg);
    vscode.postMessage({ type: 'updateSettings', language, payload: configs } satisfies WebviewMsg);
  }, []);
  const oobeDone = useCallback(() => {
    vscode.postMessage({ type: 'oobeDone' } satisfies WebviewMsg);
  }, []);

  return (
    <OobeContext.Provider
      value={{
        state,
        getLanguageList,
        getLanguageInfo,
        checkLanguageInfo,
        updateSettings,
        oobeDone,
      }}
    >
      {children}
    </OobeContext.Provider>
  );
};

export const useOobe = () => {
  const state = useContext(OobeContext);
  if (state === undefined) throw new Error('useOobe must be used within a OobeProvider');
  return state;
};
