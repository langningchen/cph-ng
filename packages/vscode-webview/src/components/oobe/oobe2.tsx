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

import type { ToolchainInfo, ToolchainItem } from '@cph-ng/core';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { CphNgText } from '@/components/base/cphNgText';
import { CphNgTooltip } from '@/components/base/cphNgTooltip';
import { OOBEPage } from '@/components/oobe/oobePage';
import { useOobe } from '@/context/OobeContext';
import Oobe2Svg from './oobe-2.svg';

export interface Step2Props {
  language: string;
  onNext: (
    compiler?: string,
    compilerArgs?: string,
    interpreter?: string,
    interpreterArgs?: string,
  ) => void;
  onBack: () => void;
}

type Status = ToolchainItem | 'invalid' | 'loading' | 'unknown';

interface CompilerOrRunnerListProps {
  title: string;
  info: ToolchainInfo | undefined;
  selectedPath: string;
  selectedArgs: string;
  onInput: () => void;
  onChangePath: (path: string) => void;
  onChangeArgs: (args: string) => void;
  onRefresh: () => void;
  onRestore: () => void;
  status: Status;
}

function CompilerOrRunnerList({
  title,
  info,
  selectedPath,
  selectedArgs,
  onInput,
  onChangePath,
  onChangeArgs,
  onRefresh,
  onRestore,
  status,
}: CompilerOrRunnerListProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 2 }}>
      <CphNgFlex sx={{ mb: 2, justifyContent: 'space-between' }}>
        <CphNgText variant='h6' sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
          {title}
        </CphNgText>
        <Stack direction='row' spacing={1}>
          <CphNgButton name={t('oobe.step2.restore')} icon={RestartAltIcon} onClick={onRestore} />
          <CphNgButton
            name={t('oobe.step2.refresh')}
            icon={RefreshIcon}
            onClick={onRefresh}
            disabled={!info?.list}
          />
        </Stack>
      </CphNgFlex>

      <Stack spacing={2}>
        <Autocomplete
          fullWidth
          freeSolo
          loading={!info?.list}
          loadingText={t('oobe.step2.loading')}
          options={info?.list || []}
          value={selectedPath}
          onInput={onInput}
          onChange={(_, newValue) => {
            const path = typeof newValue === 'string' ? newValue : newValue?.path || '';
            onChangePath(path);
          }}
          onBlur={(event) => {
            const target = event.target as HTMLInputElement;
            onChangePath(target.value);
          }}
          isOptionEqualToValue={(option, val) =>
            typeof val === 'string' ? option.path === val : option.path === val?.path
          }
          groupBy={(option) => option.group}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.path)}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <li key={option.path} {...optionProps}>
                <Box sx={{ width: '100%', py: 0.5 }}>
                  <CphNgText sx={{ wordBreak: 'break-all', display: 'block' }}>
                    <b>{option.name}</b>
                    &emsp;
                    <span style={{ opacity: 0.7 }}>{option.version}</span>
                  </CphNgText>
                  <CphNgText
                    sx={{
                      wordBreak: 'break-all',
                      display: 'block',
                      color: 'text.secondary',
                      fontSize: '0.8rem',
                    }}
                  >
                    {option.path}
                  </CphNgText>
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('oobe.step2.path')}
              placeholder={info?.default || undefined}
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  placeholder: info?.default || undefined,
                  endAdornment: (
                    <>
                      {status === 'loading' ? (
                        <CircularProgress size={20} color='inherit' />
                      ) : status === 'invalid' ? (
                        <ErrorIcon color='error' />
                      ) : status === 'unknown' ? null : (
                        <CphNgTooltip
                          title={`${status.name} ${status.version} - ${status.description || t('oobe.step2.unknownDescription')}`}
                        >
                          <CheckCircleIcon color='success' />
                        </CphNgTooltip>
                      )}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
              sx={{ '& input': { fontFamily: 'monospace' } }}
            />
          )}
        />
        <TextField
          fullWidth
          label={t('oobe.step2.args')}
          value={selectedArgs}
          onChange={(e) => onChangeArgs(e.target.value)}
          placeholder={info?.args || ''}
          sx={{ '& textarea': { fontFamily: 'monospace' } }}
        />
      </Stack>
    </Paper>
  );
}

export function OobeStep2({ language, onBack, onNext }: Step2Props) {
  const { t } = useTranslation();
  const { state, getLanguageInfo, checkLanguageInfo } = useOobe();

  const [useCompiler, setUseCompiler] = useState(true);
  const [compiler, setCompiler] = useState<string>('');
  const [compilerStatus, setCompilerStatus] = useState<Status>('unknown');
  const [compilerArgs, setCompilerArgs] = useState<string>('');

  const [useInterpreter, setUseInterpreter] = useState(true);
  const [interpreter, setInterpreter] = useState<string>('');
  const [interpreterStatus, setInterpreterStatus] = useState<Status>('unknown');
  const [interpreterArgs, setInterpreterArgs] = useState<string>('');

  const [hasInitialized, setHasInitialized] = useState(false);
  const previousLanguageRef = useRef(language);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    setHasInitialized(false);
    setCompiler('');
    setCompilerArgs('');
    setCompilerStatus('unknown');
    setInterpreter('');
    setInterpreterArgs('');
    setInterpreterStatus('unknown');
  }, [language]);

  useEffect(() => {
    getLanguageInfo(language, 'compiler');
    getLanguageInfo(language, 'interpreter');
  }, [language, getLanguageInfo]);
  useEffect(() => {
    const configs = state.languages?.[language]?.configs;
    const compilers = state.languages?.[language]?.compilers;
    const interpreters = state.languages?.[language]?.interpreters;
    setUseCompiler(configs?.compiler !== undefined);
    setUseInterpreter(configs?.interpreter !== undefined);

    if (!hasInitialized) {
      if (compilers?.default && !compiler) {
        setCompiler(compilers.default);
        setCompilerArgs(compilers.args || '');
      }
      if (interpreters?.default && !interpreter) {
        setInterpreter(interpreters.default);
        setInterpreterArgs(interpreters.args || '');
      }
      if ((!configs?.compiler || !!compilers) && (!configs?.interpreter || !!interpreters))
        setHasInitialized(true);
    }
  }, [language, state.languages, compiler, interpreter, hasInitialized]);

  useEffect(() => {
    if (!compiler) return;
    setCompilerStatus('loading');
    checkLanguageInfo(language, 'compiler', compiler).then((item) => {
      setCompilerStatus(item ? item : 'invalid');
    });
  }, [compiler, language, checkLanguageInfo]);

  useEffect(() => {
    if (!interpreter) return;
    setInterpreterStatus('loading');
    checkLanguageInfo(language, 'interpreter', interpreter).then((item) => {
      setInterpreterStatus(item ? item : 'invalid');
    });
  }, [interpreter, language, checkLanguageInfo]);

  const handleRestore = (type: 'compiler' | 'interpreter') => {
    const info = state.languages?.[language]?.[type === 'compiler' ? 'compilers' : 'interpreters'];
    if (type === 'compiler') {
      setCompiler(info?.default || '');
      setCompilerArgs(info?.args || '');
    } else {
      setInterpreter(info?.default || '');
      setInterpreterArgs(info?.args || '');
    }
  };

  return (
    <OOBEPage
      svg={Oobe2Svg}
      title={t('oobe.step2.title', { language })}
      subtitle={t('oobe.step2.subtitle')}
      step={2}
      totalSteps={4}
      onBack={onBack}
      onNext={() => onNext(compiler, compilerArgs, interpreter, interpreterArgs)}
    >
      {hasInitialized ? (
        <Stack spacing={2}>
          <CphNgText>{t('oobe.step2.description')}</CphNgText>
          {!!useCompiler && (
            <CompilerOrRunnerList
              title={t('oobe.step2.compiler')}
              info={state.languages?.[language]?.compilers}
              selectedPath={compiler}
              selectedArgs={compilerArgs}
              onInput={() => setCompilerStatus('unknown')}
              onChangePath={setCompiler}
              onChangeArgs={setCompilerArgs}
              onRefresh={() => getLanguageInfo(language, 'compiler')}
              onRestore={() => handleRestore('compiler')}
              status={compilerStatus}
            />
          )}
          {!!useInterpreter && (
            <CompilerOrRunnerList
              title={t('oobe.step2.interpreter')}
              info={state.languages?.[language]?.interpreters}
              selectedPath={interpreter}
              selectedArgs={interpreterArgs}
              onInput={() => setInterpreterStatus('unknown')}
              onChangePath={setInterpreter}
              onChangeArgs={setInterpreterArgs}
              onRefresh={() => getLanguageInfo(language, 'interpreter')}
              onRestore={() => handleRestore('interpreter')}
              status={interpreterStatus}
            />
          )}
        </Stack>
      ) : (
        <CphNgFlex column>
          <CircularProgress />
          <CphNgText sx={{ textAlign: 'center' }}>{t('oobe.step2.initializing')}</CphNgText>
        </CphNgFlex>
      )}
    </OOBEPage>
  );
}
