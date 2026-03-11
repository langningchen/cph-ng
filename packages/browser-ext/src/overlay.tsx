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

import React from 'react';
import { browser } from 'wxt/browser';

interface Props {
  error?: string | null;
}

export const LoadingOverlay = ({ error }: Props) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999999,
      backdropFilter: 'blur(2px)',
    }}
  >
    <div
      style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        width: '300px',
        height: '185px',
        textAlign: 'center',
      }}
    >
      <img
        src={browser.runtime.getURL('/icons/128.png')}
        alt='Logo'
        style={{ width: 48, height: 48 }}
      />

      {error ? (
        <div style={{ color: '#d32f2f', fontSize: '14px', fontWeight: 'bold' }}>{error}</div>
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  </div>
);
