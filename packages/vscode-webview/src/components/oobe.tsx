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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MobileStepper from '@mui/material/MobileStepper';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CphNgButton } from '@/components/base/cphNgButton';
import { CphNgFlex } from '@/components/base/cphNgFlex';
import { openLink, urls } from '@/utils';

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

  const steps = [
    <CphNgFlex column gap={2} key={1}>
      <img
        width='30%'
        style={{ minWidth: '100px', maxWidth: '200px' }}
        src={cphNgUri}
        alt='CPH-NG Icon'
      />
      <Typography textAlign='center' variant='h5' gutterBottom>
        {t('oobe.step1.title')}
      </Typography>
      <Typography>{t('oobe.step1.content')}</Typography>
      <Alert severity='info'>{t('oobe.step1.alert')}</Alert>
    </CphNgFlex>,

    <CphNgFlex alignStart column gap={2} key={4}>
      <Typography variant='h5'>{t('oobe.step4.title')}</Typography>
      <Typography variant='subtitle2'>{t('oobe.step4.subtitle')}</Typography>
      <Card>
        <CardContent>
          <Typography variant='h6'>{t('oobe.step4.edge')}</Typography>
          <Typography variant='body2'>{t('oobe.step4.edge.description')}</Typography>
        </CardContent>
        <CardActions>
          <Button href={urls.edgeAddon} size='small'>
            {t('oobe.step4.get')}
          </Button>
        </CardActions>
      </Card>
      <Card>
        <CardContent>
          <Typography variant='h6'>{t('oobe.step4.firefox')}</Typography>
          <Typography variant='body2'>{t('oobe.step4.firefox.description')}</Typography>
        </CardContent>
        <CardActions>
          <Button href={urls.edgeAddon} size='small'>
            {t('oobe.step4.get')}
          </Button>
        </CardActions>
      </Card>
      <Card>
        <CardContent>
          <Typography variant='h6'>{t('oobe.step4.chrome')}</Typography>
          <Typography variant='body2'>{t('oobe.step4.chrome.description')}</Typography>
        </CardContent>
        <CardActions>
          <Button href={urls.github} size='small'>
            {t('oobe.step4.download')}
          </Button>
        </CardActions>
      </Card>
    </CphNgFlex>,

    <CphNgFlex alignStart column gap={2} key={5}>
      <Typography variant='h5'>{t('oobe.step5.title')}</Typography>
      <Typography variant='subtitle2'>{t('oobe.step5.subtitle')}</Typography>
      <Paper>
        <List>
          <ListItem disablePadding onClick={openLink(urls.joinQQ)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.joinQQ')}
                secondary={t('oobe.step5.joinQQ.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.github)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.source')}
                secondary={t('oobe.step5.source.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.settings)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.openSettings')}
                secondary={t('oobe.step5.openSettings.description')}
              />
            </ListItemButton>
          </ListItem>
          <Divider />
          <ListItem disablePadding onClick={openLink(urls.docs)}>
            <ListItemButton>
              <ListItemText
                primary={t('oobe.step5.docs')}
                secondary={t('oobe.step5.docs.description')}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Paper>
    </CphNgFlex>,
  ];

  return (
    <CphNgFlex alignStart column height='100%'>
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
      <Box flex={1} sx={{ p: 2 }}>
        {steps[activeStep]}
      </Box>
    </CphNgFlex>
  );
};
