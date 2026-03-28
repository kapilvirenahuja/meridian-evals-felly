'use client';

import { useState } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search mentors...' }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange(inputValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value === '') {
      onChange('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full">
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="search"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search mentors"
        />
      </div>
      <button
        type="submit"
        className="ml-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
