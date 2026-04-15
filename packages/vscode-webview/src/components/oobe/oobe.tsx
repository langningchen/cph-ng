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

import DoneIcon from '@mui/icons-material/Done';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Box from '@mui/material/Box';
import MobileStepper from '@mui/material/MobileStepper';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { oobe1 } from '@/components/oobe/oobe1';
import { oobe3 } from '@/components/oobe/oobe3';
import { oobe4 } from '@/components/oobe/oobe4';
import { oobe5 } from '@/components/oobe/oobe5';

export const OobeView = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  const handleDone = () => {
    setActiveStep(0);
  };
  const steps = [oobe1, oobe3, oobe4, oobe5];

  return (
    <CphNgFlex alignStart column sx={{ height: '100%' }}>
      <MobileStepper
        steps={steps.length}
        activeStep={activeStep}
        nextButton={
          activeStep === steps.length - 1 ? (
            <CphNgButton icon={DoneIcon} name={t('oobe.done')} onClick={handleDone} />
          ) : (
            <CphNgButton icon={NavigateNextIcon} name={t('oobe.next')} onClick={handleNext} />
          )
        }
        backButton={
          <CphNgButton
            icon={NavigateBeforeIcon}
            name={t('oobe.back')}
            onClick={handleBack}
            disabled={activeStep === 0}
          />
        }
      />
      {steps.map((StepComponent, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Array does not modify
        <Box key={index} sx={{ flex: 1, p: 2, display: index === activeStep ? 'block' : 'none' }}>
          {StepComponent()}
        </Box>
      ))}
    </CphNgFlex>
  );
};
