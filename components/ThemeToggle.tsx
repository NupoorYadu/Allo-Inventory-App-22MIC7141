"use client"

import React, { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null
    if (stored) {
      applyTheme(stored)
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(prefersDark ? 'dark' : 'light')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyTheme(t: 'dark' | 'light') {
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    try {
      localStorage.setItem('theme', t)
    } catch {}
    setTheme(t)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        aria-label="Toggle theme"
        className="px-3 py-2 rounded border bg-white text-sm dark:bg-gray-800 dark:text-white"
        onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      </button>
    </div>
  )
}
