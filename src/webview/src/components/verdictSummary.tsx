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

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VerdictType } from '@/domain/entities/verdict';
import type { TestcaseId } from '@/domain/types';
import type { IWebviewTestcase } from '@/domain/webviewTypes';
import { CphFlex } from './base/cphFlex';

interface VerdictSummaryProps {
  testcaseOrder: TestcaseId[];
  testcases: Record<TestcaseId, IWebviewTestcase>;
}

export const VerdictSummary = memo(({ testcaseOrder, testcases }: VerdictSummaryProps) => {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    const total = testcaseOrder.length;

    for (const id of testcaseOrder) {
      const tc = testcases[id];
      if (!tc || tc.isDisabled) continue;
      if (!tc.result?.verdict) {
        pending++;
      } else if (tc.result.verdict.type === VerdictType.passed) {
        passed++;
      } else if (tc.result.verdict.type === VerdictType.running) {
        running++;
      } else {
        failed++;
      }
    }
    return { passed, failed, running, pending, total };
  }, [testcaseOrder, testcases]);

  if (stats.total === 0) return null;

  return (
    <CphFlex alignStart flexWrap='wrap' sx={{ display: { xs: 'none', sm: 'flex' } }}>
      {stats.passed > 0 && (
        <Tooltip disableInteractive followCursor title={t('verdictSummary.passed')}>
          <Chip
            icon={<CheckCircleIcon />}
            label={stats.passed}
            size='small'
            color='success'
            variant='outlined'
          />
        </Tooltip>
      )}
      {stats.failed > 0 && (
        <Tooltip disableInteractive followCursor title={t('verdictSummary.failed')}>
          <Chip
            icon={<ErrorIcon />}
            label={stats.failed}
            size='small'
            color='error'
            variant='outlined'
          />
        </Tooltip>
      )}
      {stats.running > 0 && (
        <Tooltip disableInteractive followCursor title={t('verdictSummary.running')}>
          <Chip
            icon={<HourglassEmptyIcon />}
            label={stats.running}
            size='small'
            color='info'
            variant='outlined'
          />
        </Tooltip>
      )}
      {stats.pending > 0 && (
        <Tooltip disableInteractive followCursor title={t('verdictSummary.pending')}>
          <Chip
            icon={<RemoveCircleOutlineIcon />}
            label={stats.pending}
            size='small'
            variant='outlined'
          />
        </Tooltip>
      )}
    </CphFlex>
  );
});
