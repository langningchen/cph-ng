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

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

interface HoleRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface OverlayProps {
  info?: string | null;
  error?: string | null;
  holeSelector?: string | null;
}

export const LoadingOverlay = ({ info, error, holeSelector }: OverlayProps) => {
  const [hole, setHole] = useState<HoleRect | null>(null);

  useEffect(() => {
    if (!holeSelector) return;

    const updateHole = () => {
      const el = document.querySelector(holeSelector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setHole({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updateHole();

    const observer = new ResizeObserver(updateHole);
    const el = document.querySelector(holeSelector);
    if (el) observer.observe(el);
    window.addEventListener('scroll', updateHole, true);
    window.addEventListener('resize', updateHole);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateHole, true);
      window.removeEventListener('resize', updateHole);
    };
  }, [holeSelector]);

  const clipPath = hole
    ? `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${hole.left}px ${hole.top}px,
        ${hole.left}px ${hole.top + hole.height}px,
        ${hole.left + hole.width}px ${hole.top + hole.height}px,
        ${hole.left + hole.width}px ${hole.top}px,
        ${hole.left}px ${hole.top}px
      )`
    : undefined;

  return (
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
        clipPath,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          width: 300,
          minHeight: 185,
          textAlign: 'center',
        }}
      >
        <img
          src={browser.runtime.getURL('/icons/128.png')}
          alt='Logo'
          style={{ width: 48, height: 48 }}
        />

        {!!info && <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{info}</div>}

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
};
