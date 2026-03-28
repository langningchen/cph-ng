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

import { useTranslation } from 'react-i18next';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { CphNgText } from '@/components/base/cphNgText';

export const AcCongrats = () => {
  const { t } = useTranslation();

  return (
    <CphNgFlex column>
      <img width='30%' src={partyUri} alt='AC congratulations gif' />
      <CphNgText textAlign='center'>
        {t('acCongrats.firstLine')}
        <br />
        {t('acCongrats.secondLine')}
      </CphNgText>
    </CphNgFlex>
  );
};
