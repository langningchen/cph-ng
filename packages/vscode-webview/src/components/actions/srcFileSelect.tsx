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

import type { ProblemId } from '@cph-ng/core';
import CloseIcon from '@mui/icons-material/Close';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import Typography from '@mui/material/Typography';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { CphNgLink } from '@/components/base/cphNgLink';
import { useProblem } from '@/context/ProblemContext';

interface SrcFileSelectProps {
  label: string;
  file: { path: string; base: string } | null;
  problemId: ProblemId;
  fileType: 'generator' | 'bruteForce';
}

export const SrcFileSelect = memo(({ label, file, problemId, fileType }: SrcFileSelectProps) => {
  const { t } = useTranslation();
  const { dispatch } = useProblem();

  return (
    <CphNgFlex>
      <Typography>{label}</Typography>
      {file ? (
        <>
          <CphNgLink
            name={file.path}
            onClick={() => dispatch({ type: 'openFile', path: file.path })}
          >
            {file.base}
          </CphNgLink>
          <CphNgButton
            icon={CloseIcon}
            onClick={() =>
              dispatch({
                type: 'removeSrcFile',
                problemId,
                fileType,
              })
            }
            name={
              fileType === 'generator'
                ? t('problemActions.stressTestDialog.button.removeGenerator')
                : t('problemActions.stressTestDialog.button.removeBruteForce')
            }
          />
        </>
      ) : (
        <CphNgButton
          icon={FileOpenIcon}
          onClick={() =>
            dispatch({
              type: 'chooseSrcFile',
              problemId,
              fileType,
            })
          }
          name={
            fileType === 'generator'
              ? t('problemActions.stressTestDialog.button.chooseGenerator')
              : t('problemActions.stressTestDialog.button.chooseBruteForce')
          }
        />
      )}
    </CphNgFlex>
  );
});
