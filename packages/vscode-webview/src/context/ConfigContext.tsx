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

import type { WebviewConfig } from '@cph-ng/core';
import { createContext, type ReactNode, useContext, useEffect, useReducer } from 'react';

interface ConfigStateLoading {
  isReady: false;
  config: Partial<WebviewConfig>;
}

interface ConfigStateReady {
  isReady: true;
  config: WebviewConfig;
}

type ConfigState = ConfigStateLoading | ConfigStateReady;

const ConfigContext = createContext<ConfigState | undefined>(undefined);

const requiredKeys: (keyof WebviewConfig)[] = [
  'confirmSubmit',
  'showAcGif',
  'showOobe',
  'hiddenStatuses',
];

const isConfigComplete = (config: Partial<WebviewConfig>): config is WebviewConfig => {
  return requiredKeys.every((key) => key in config && config[key] !== undefined);
};

const configReducer = (state: ConfigState, action: Partial<WebviewConfig>): ConfigState => {
  const newConfig = { ...state.config, ...action };
  if (isConfigComplete(newConfig)) return { isReady: true, config: newConfig };
  return { isReady: false, config: newConfig };
};

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(configReducer, {
    isReady: false,
    config: {},
  });

  useEffect(() => {
    const handleMessage = ({ data }: MessageEvent) => {
      if (data.type === 'configChange') dispatch(data.payload);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return <ConfigContext.Provider value={state}>{children}</ConfigContext.Provider>;
};

export const useConfigState = (): ConfigState => {
  const state = useContext(ConfigContext);
  if (state === undefined) throw new Error('useConfigState must be used within a ConfigProvider');
  return state;
};

export const useConfig = (): WebviewConfig => {
  const state = useConfigState();
  if (!state.isReady)
    throw new Error(
      'useConfig called before config is ready. Use useConfigState to check isReady first.',
    );
  return state.config;
};
