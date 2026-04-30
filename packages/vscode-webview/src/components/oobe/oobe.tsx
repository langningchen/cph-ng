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

import type { ILanguageDefaultValues } from '@cph-ng/core';
import { useState } from 'react';
import { OobeStep1 } from '@/components/oobe/oobe1';
import { OobeStep2 } from '@/components/oobe/oobe2';
import { OobeStep3 } from '@/components/oobe/oobe3';
import { OobeStep4 } from '@/components/oobe/oobe4';
import { OobeProvider } from '@/context/OobeContext';

export function OobeView() {
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState('C++');
  const [languageConfig, setLanguageConfig] = useState<ILanguageDefaultValues>({});

  return (
    <OobeProvider>
      {step === 1 && (
        <OobeStep1
          language={language}
          setLanguage={setLanguage}
          onSkip={() => {}}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <OobeStep2
          language={language}
          onNext={(compiler, compilerArgs, interpreter, interpreterArgs) => {
            setLanguageConfig({ compiler, compilerArgs, interpreter, interpreterArgs });
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && <OobeStep3 onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && (
        <OobeStep4
          config={{ language, languageConfig }}
          onBack={() => setStep(3)}
          onDone={() => {}}
        />
      )}
    </OobeProvider>
  );
}
