# Epic 5: Job Title & Occupation Mapping

**Project:** Task Capture Survey Tool (Futura)
**Epic:** Job Title Input & O*NET Occupation Matching
**Status:** V1 Implementation Spec

**Related Docs:**
- [Technical Implementation Plan](./technical-implementation.md)
- [Epic 1: Chat Interface](./epic-1-chat-interface.md) — receives job title + occupation code
- [Epic 2: O*NET Integration](./epic-2-onet-integration.md) — occupation lookup service

---

## Overview

This epic covers the initial job title input where users enter their job title. In V1, we use a simple **CSV lookup** for common titles rather than a full occupation selection UI.

### V1 Scope

| Feature | V1 Status |
|---------|-----------|
| Job title free text input | ✅ In scope |
| CSV lookup for common titles | ✅ In scope |
| Store matched occupation code | ✅ In scope |
| Full autocomplete UI | ❌ Deferred to V2 |
| Occupation selection list | ❌ Deferred to V2 |
| Alternative titles search | ❌ Deferred to V2 |

### Goals (V1)

1. Clean job title input (free text)
2. CSV lookup for common job titles → O*NET code
3. Proceed with or without match
4. Pass occupation code (if matched) to chat

### User Flow (V1 Simplified)

```
[Landing Page]
    → Job Title Input Screen
        → User types job title
        → Submit
        → (Background) CSV lookup for O*NET code
    → [Chat Interface with jobTitle + optional occupationCode]
```

---

## V1 Implementation: CSV Lookup

In V1, we use a simple CSV file loaded at build time (or in a database table) to map common job titles to O*NET codes. No user-facing selection UI.

### Job Titles CSV Format

```csv
common_title,onet_code,onet_title,confidence
"Policy Advisor",13-1199.02,"Policy Analysts",0.95
"Software Engineer",15-1252.00,"Software Developers",0.95
"Software Developer",15-1252.00,"Software Developers",0.99
"Data Scientist",15-2051.00,"Data Scientists",0.95
"Product Manager",11-2021.00,"Marketing Managers",0.80
"Nurse",29-1141.00,"Registered Nurses",0.90
"Teacher",25-2021.00,"Elementary School Teachers",0.85
```

### Lookup Logic

```typescript
// job-title-lookup.service.ts
import { Injectable } from '@nestjs/common';
import * as jobTitles from '../data/job-titles.json';

interface JobTitleMatch {
  commonTitle: string;
  onetCode: string;
  onetTitle: string;
  confidence: number;
}

@Injectable()
export class JobTitleLookupService {
  private titleMap: Map<string, JobTitleMatch>;

  constructor() {
    this.titleMap = new Map();
    for (const entry of jobTitles) {
      // Store with lowercase key for case-insensitive lookup
      this.titleMap.set(entry.common_title.toLowerCase(), {
        commonTitle: entry.common_title,
        onetCode: entry.onet_code,
        onetTitle: entry.onet_title,
        confidence: entry.confidence,
      });
    }
  }

  lookup(jobTitle: string): JobTitleMatch | null {
    const normalized = jobTitle.toLowerCase().trim();

    // Exact match
    if (this.titleMap.has(normalized)) {
      return this.titleMap.get(normalized)!;
    }

    // Fuzzy match (simple: check if input contains a known title)
    for (const [key, value] of this.titleMap) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    return null;
  }
}
```

### Frontend (V1 Simplified)

Simple text input → submit → proceed to chat.

```typescript
// job-title-input-simple.tsx (V1)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@apolitical/futura/lib/elements/ui/input';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { useTranslations } from 'next-intl';

export function JobTitleInputSimple() {
  const t = useTranslations('client.futura.job-title');
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!jobTitle.trim()) return;

    setIsLoading(true);

    // Background lookup (doesn't block user)
    const response = await fetch(
      `/api/futura-api/job-title/lookup?title=${encodeURIComponent(jobTitle)}`
    );

    let occupationCode: string | undefined;
    if (response.ok) {
      const data = await response.json();
      occupationCode = data.onetCode;
    }

    // Proceed to chat with or without match
    const params = new URLSearchParams({
      jobTitle: jobTitle.trim(),
      ...(occupationCode && { occupationCode }),
    });

    router.push(`/futura/chat?${params.toString()}`);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-n-900 mb-2">
          {t('title')}
        </h1>
        <p className="text-n-600">{t('subtitle')}</p>
      </div>

      <Input
        type="text"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        placeholder={t('placeholder')}
        className="text-lg py-6"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />

      <Button
        onClick={handleSubmit}
        disabled={!jobTitle.trim() || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? t('loading') : t('continue')}
      </Button>
    </div>
  );
}
```

---

## V2 (Deferred): Full Implementation

The following file structure and components are deferred to V2.

### File Structure (V2)

```
futura-ui/src/app/[locale]/futura/
├── page.tsx                              # Landing page
├── job-title/
│   └── page.tsx                          # /futura/job-title route
├── _components/
│   └── job-title/
│       ├── index.ts
│       ├── job-title-container.tsx       # Main container
│       ├── job-title-input.tsx           # Input with autocomplete
│       ├── occupation-card.tsx           # Occupation suggestion card
│       ├── occupation-selector.tsx       # Selection list
│       ├── no-match-fallback.tsx         # When no match found
│       └── context/
│           ├── job-title-context.tsx
│           └── job-title-types.ts
```

---

### Component Specifications

#### `job-title-container.tsx`

Main container with step flow.

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { JobTitleInput } from './job-title-input';
import { OccupationSelector } from './occupation-selector';
import { NoMatchFallback } from './no-match-fallback';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { useTranslations } from 'next-intl';
import type { ONetOccupation } from './context/job-title-types';

type Step = 'input' | 'select' | 'no-match';

interface JobTitleContainerProps {
  onComplete: (data: JobTitleData) => void;
}

interface JobTitleData {
  jobTitle: string;
  occupation?: ONetOccupation;
  occupationCode?: string;
}

export function JobTitleContainer({ onComplete }: JobTitleContainerProps) {
  const t = useTranslations('client.futura.job-title');
  const router = useRouter();

  const [step, setStep] = useState<Step>('input');
  const [jobTitle, setJobTitle] = useState('');
  const [occupations, setOccupations] = useState<ONetOccupation[]>([]);
  const [selectedOccupation, setSelectedOccupation] = useState<ONetOccupation | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (title: string) => {
    if (title.length < 2) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/futura-api/onet/occupations/search?query=${encodeURIComponent(title)}&limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        setOccupations(data.occupations);

        if (data.occupations.length > 0) {
          setStep('select');
        } else {
          setStep('no-match');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setStep('no-match');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputSubmit = (title: string) => {
    setJobTitle(title);
    handleSearch(title);
  };

  const handleOccupationSelect = (occupation: ONetOccupation) => {
    setSelectedOccupation(occupation);
  };

  const handleConfirm = () => {
    if (selectedOccupation) {
      onComplete({
        jobTitle,
        occupation: selectedOccupation,
        occupationCode: selectedOccupation.code,
      });
    }
  };

  const handleSkip = () => {
    onComplete({
      jobTitle,
      occupation: undefined,
      occupationCode: undefined,
    });
  };

  const handleBack = () => {
    setStep('input');
    setOccupations([]);
    setSelectedOccupation(null);
  };

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-n-900 mb-3">
          {t('title')}
        </h1>
        <p className="text-n-600">
          {t('subtitle')}
        </p>
      </div>

      {/* Step: Input */}
      {step === 'input' && (
        <JobTitleInput
          value={jobTitle}
          onChange={setJobTitle}
          onSubmit={handleInputSubmit}
          isLoading={isSearching}
        />
      )}

      {/* Step: Select occupation */}
      {step === 'select' && (
        <div className="space-y-6">
          <OccupationSelector
            occupations={occupations}
            selected={selectedOccupation}
            onSelect={handleOccupationSelect}
            jobTitle={jobTitle}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              {t('back')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedOccupation}
            >
              {t('continue')}
            </Button>
          </div>

          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-sm text-n-500 hover:text-n-700 underline"
            >
              {t('skip-matching')}
            </button>
          </div>
        </div>
      )}

      {/* Step: No match */}
      {step === 'no-match' && (
        <NoMatchFallback
          jobTitle={jobTitle}
          onBack={handleBack}
          onContinue={handleSkip}
        />
      )}
    </div>
  );
}
```

#### `job-title-input.tsx`

Input field with inline autocomplete suggestions.

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@apolitical/futura/lib/elements/ui/input';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { SearchIcon, LoaderIcon } from '@apolitical/futura/lib/elements/icons';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@apolitical/futura/lib/hooks/useDebounce';
import { cn } from '@apolitical/futura/lib/utils/utils';
import type { ONetOccupation } from './context/job-title-types';

interface JobTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isLoading?: boolean;
}

export function JobTitleInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: JobTitleInputProps) {
  const t = useTranslations('client.futura.job-title');
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<ONetOccupation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions on debounced value change
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedValue.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsFetchingSuggestions(true);
      try {
        const response = await fetch(
          `/api/futura-api/onet/occupations/search?query=${encodeURIComponent(debouncedValue)}&limit=5`
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.occupations);
          setShowSuggestions(data.occupations.length > 0);
        }
      } catch (error) {
        console.error('Suggestion fetch failed:', error);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && value.trim()) {
        onSubmit(value.trim());
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onChange(suggestions[highlightedIndex].title);
          setShowSuggestions(false);
          onSubmit(suggestions[highlightedIndex].title);
        } else if (value.trim()) {
          setShowSuggestions(false);
          onSubmit(value.trim());
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleSuggestionClick = (occupation: ONetOccupation) => {
    onChange(occupation.title);
    setShowSuggestions(false);
    onSubmit(occupation.title);
  };

  const handleSubmit = () => {
    if (value.trim()) {
      setShowSuggestions(false);
      onSubmit(value.trim());
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Input */}
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t('placeholder')}
            className="text-lg py-6 pr-12"
            autoComplete="off"
          />
          {isFetchingSuggestions && (
            <LoaderIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-n-400 animate-spin" />
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-n-200 shadow-lg">
            {suggestions.map((occupation, index) => (
              <button
                key={occupation.code}
                onClick={() => handleSuggestionClick(occupation)}
                className={cn(
                  'w-full text-left px-4 py-3 hover:bg-n-50 transition-colors',
                  'border-b border-n-100 last:border-b-0',
                  index === highlightedIndex && 'bg-n-50'
                )}
              >
                <div className="font-medium text-n-900">
                  {occupation.title}
                </div>
                <div className="text-sm text-n-500 line-clamp-1">
                  {occupation.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
            {t('searching')}
          </>
        ) : (
          <>
            <SearchIcon className="h-5 w-5 mr-2" />
            {t('find-occupation')}
          </>
        )}
      </Button>

      {/* Help text */}
      <p className="text-center text-sm text-n-500">
        {t('help-text')}
      </p>
    </div>
  );
}
```

#### `occupation-selector.tsx`

List of occupation matches for user to select.

```typescript
'use client';

import { OccupationCard } from './occupation-card';
import { useTranslations } from 'next-intl';
import type { ONetOccupation } from './context/job-title-types';

interface OccupationSelectorProps {
  occupations: ONetOccupation[];
  selected: ONetOccupation | null;
  onSelect: (occupation: ONetOccupation) => void;
  jobTitle: string;
}

export function OccupationSelector({
  occupations,
  selected,
  onSelect,
  jobTitle,
}: OccupationSelectorProps) {
  const t = useTranslations('client.futura.job-title');

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-n-700">
          {t('select-prompt', { title: jobTitle })}
        </p>
      </div>

      <div className="space-y-3">
        {occupations.map((occupation, index) => (
          <OccupationCard
            key={occupation.code}
            occupation={occupation}
            isSelected={selected?.code === occupation.code}
            onClick={() => onSelect(occupation)}
            isBestMatch={index === 0}
          />
        ))}
      </div>

      {/* "None of these" option */}
      <OccupationCard
        occupation={{
          code: 'none',
          title: t('none-of-these'),
          description: t('none-of-these-desc'),
        }}
        isSelected={selected?.code === 'none'}
        onClick={() => onSelect({
          code: 'none',
          title: jobTitle,
          description: '',
        })}
        variant="outline"
      />
    </div>
  );
}
```

#### `occupation-card.tsx`

Individual occupation card.

```typescript
'use client';

import { Card } from '@apolitical/futura/lib/elements/ui/card';
import { CheckIcon, StarIcon } from '@apolitical/futura/lib/elements/icons';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';
import type { ONetOccupation } from './context/job-title-types';

interface OccupationCardProps {
  occupation: ONetOccupation;
  isSelected: boolean;
  onClick: () => void;
  isBestMatch?: boolean;
  variant?: 'default' | 'outline';
}

export function OccupationCard({
  occupation,
  isSelected,
  onClick,
  isBestMatch = false,
  variant = 'default',
}: OccupationCardProps) {
  const t = useTranslations('client.futura.job-title');

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary bg-primary/5'
          : 'hover:border-n-400',
        variant === 'outline' && 'border-dashed'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div
          className={cn(
            'mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
            isSelected
              ? 'bg-primary border-primary'
              : 'border-n-300'
          )}
        >
          {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-n-900">
              {occupation.title}
            </h3>
            {isBestMatch && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                <StarIcon className="h-3 w-3" />
                {t('best-match')}
              </span>
            )}
          </div>
          {occupation.description && (
            <p className="text-sm text-n-600 mt-1 line-clamp-2">
              {occupation.description}
            </p>
          )}
          {occupation.code !== 'none' && (
            <p className="text-xs text-n-400 mt-1">
              SOC: {occupation.code}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
```

#### `no-match-fallback.tsx`

Fallback when no occupation matches found.

```typescript
'use client';

import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { AlertCircleIcon } from '@apolitical/futura/lib/elements/icons';
import { useTranslations } from 'next-intl';

interface NoMatchFallbackProps {
  jobTitle: string;
  onBack: () => void;
  onContinue: () => void;
}

export function NoMatchFallback({
  jobTitle,
  onBack,
  onContinue,
}: NoMatchFallbackProps) {
  const t = useTranslations('client.futura.job-title.no-match');

  return (
    <div className="text-center space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100">
        <AlertCircleIcon className="h-8 w-8 text-amber-600" />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-n-900 mb-2">
          {t('title')}
        </h2>
        <p className="text-n-600">
          {t('description', { title: jobTitle })}
        </p>
      </div>

      <div className="space-y-3">
        <Button onClick={onBack} variant="outline" className="w-full">
          {t('try-different')}
        </Button>
        <Button onClick={onContinue} className="w-full">
          {t('continue-anyway')}
        </Button>
      </div>

      <p className="text-sm text-n-500">
        {t('help-text')}
      </p>
    </div>
  );
}
```

---

### Types

```typescript
// context/job-title-types.ts

export interface ONetOccupation {
  code: string;
  title: string;
  description: string;
  similarity?: number;
}

export interface JobTitleData {
  jobTitle: string;
  occupation?: ONetOccupation;
  occupationCode?: string;
}
```

---

## Backend Implementation

The occupation search endpoint is already defined in Epic 2. Here's the relevant controller method:

```typescript
// onet.controller.ts (from Epic 2)
@TsRestHandler(onet.searchOccupations)
async searchOccupations() {
  return tsRestHandler(onet.searchOccupations, async ({ query }) => {
    const result = await this.onetService.searchOccupations({
      query: query.query,
      limit: query.limit ? parseInt(query.limit) : 10,
    });

    return { status: 200, body: result };
  });
}
```

### Enhanced Search with Alternative Titles

```typescript
// onet.service.ts - enhanced searchOccupations
async searchOccupations(request: ONetOccupationSearchRequest): Promise<ONetOccupationSearchResponse> {
  const { query, limit = 10 } = request;

  // 1. Semantic search using embeddings
  const embedding = await this.embedding.embed(query);

  const semanticResults = await this.occupationsIndex.query({
    vector: embedding,
    topK: limit * 2, // Get more for filtering
    includeMetadata: true,
  });

  // 2. Also search alternative titles (keyword-based)
  const keywordResults = await this.searchAlternativeTitles(query);

  // 3. Merge and deduplicate results
  const merged = this.mergeResults(semanticResults.matches, keywordResults);

  // 4. Sort by combined score
  const sorted = merged
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);

  return {
    occupations: sorted.map(r => ({
      code: r.code,
      title: r.title,
      description: r.description,
      similarity: r.combinedScore,
    })),
  };
}

private async searchAlternativeTitles(query: string): Promise<OccupationMatch[]> {
  // Search Supabase for alternative titles
  const { data } = await this.supabase
    .from('onet_alternative_titles')
    .select('occupation_code, alternative_title, occupation_title')
    .ilike('alternative_title', `%${query}%`)
    .limit(20);

  return data?.map(row => ({
    code: row.occupation_code,
    title: row.occupation_title,
    description: '',
    combinedScore: 0.9, // High score for exact keyword match
  })) || [];
}

private mergeResults(
  semantic: PineconeMatch[],
  keyword: OccupationMatch[],
): OccupationMatch[] {
  const seen = new Map<string, OccupationMatch>();

  // Add semantic results
  for (const match of semantic) {
    const code = match.metadata?.code as string;
    if (!seen.has(code)) {
      seen.set(code, {
        code,
        title: match.metadata?.title as string,
        description: match.metadata?.description as string,
        combinedScore: match.score || 0,
      });
    }
  }

  // Merge keyword results (boost score if already exists)
  for (const match of keyword) {
    if (seen.has(match.code)) {
      const existing = seen.get(match.code)!;
      existing.combinedScore = Math.min(1, existing.combinedScore + 0.2);
    } else {
      seen.set(match.code, match);
    }
  }

  return Array.from(seen.values());
}
```

---

## Alternative Titles Table

O*NET provides a list of alternative job titles for each occupation. We store these for keyword search.

### Schema

```sql
CREATE TABLE onet_alternative_titles (
  id SERIAL PRIMARY KEY,
  occupation_code TEXT NOT NULL,
  occupation_title TEXT NOT NULL,
  alternative_title TEXT NOT NULL,
  short_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alt_titles_code ON onet_alternative_titles(occupation_code);
CREATE INDEX idx_alt_titles_search ON onet_alternative_titles USING gin(alternative_title gin_trgm_ops);
```

### Ingestion

```typescript
// scripts/ingest-alternative-titles.ts
async function ingestAlternativeTitles() {
  const workbook = XLSX.readFile('data/onet/Alternate Titles.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: AltTitleRow[] = XLSX.utils.sheet_to_json(sheet);

  const records = rows.map(row => ({
    occupation_code: row['O*NET-SOC Code'],
    occupation_title: row['Title'],
    alternative_title: row['Alternate Title'],
    short_title: row['Short Title'] || null,
  }));

  // Batch insert
  const BATCH_SIZE = 500;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await supabase.from('onet_alternative_titles').insert(batch);
    console.log(`Inserted ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
  }
}
```

---

## Page Route

```typescript
// futura/job-title/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { JobTitleContainer } from '../_components/job-title/job-title-container';
import type { JobTitleData } from '../_components/job-title/context/job-title-types';

export default function JobTitlePage() {
  const router = useRouter();

  const handleComplete = (data: JobTitleData) => {
    // Store in session/URL params
    const params = new URLSearchParams({
      jobTitle: data.jobTitle,
      ...(data.occupationCode && { occupationCode: data.occupationCode }),
    });

    router.push(`/futura/chat?${params.toString()}`);
  };

  return <JobTitleContainer onComplete={handleComplete} />;
}
```

---

## API Contract

Already defined in Epic 2:

```typescript
// onet.contract.ts
searchOccupations: {
  method: 'GET',
  path: '/onet/occupations/search',
  query: z.object({
    query: z.string(),
    limit: z.string().optional(),
  }),
  responses: {
    200: z.object({
      occupations: z.array(z.object({
        code: z.string(),
        title: z.string(),
        description: z.string(),
        similarity: z.number().optional(),
      })),
    }),
  },
  summary: 'Search O*NET occupations by job title',
},
```

---

## Translation Keys

```json
// messages/en.json
{
  "client": {
    "futura": {
      "job-title": {
        "title": "What's your job title?",
        "subtitle": "We'll match it to our database to help identify your tasks",
        "placeholder": "e.g., Software Engineer, Policy Analyst, Nurse",
        "find-occupation": "Find matching occupations",
        "searching": "Searching...",
        "help-text": "Enter your job title as it appears on your business card or LinkedIn",

        "select-prompt": "Which best describes your role as \"{title}\"?",
        "best-match": "Best match",
        "none-of-these": "None of these match",
        "none-of-these-desc": "I'll use my own job title",

        "back": "Back",
        "continue": "Continue",
        "skip-matching": "Skip occupation matching",

        "no-match": {
          "title": "No exact matches found",
          "description": "We couldn't find an occupation matching \"{title}\" in our database",
          "try-different": "Try a different title",
          "continue-anyway": "Continue with my title",
          "help-text": "You can still proceed — we'll do our best to suggest relevant tasks"
        }
      }
    }
  }
}
```

---

## Testing

### Component Tests

```typescript
// job-title-input.spec.tsx
describe('JobTitleInput', () => {
  it('shows suggestions as user types', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        occupations: [
          { code: '11-1011.00', title: 'Chief Executives', description: 'CEO...' },
        ],
      }),
    });

    render(<JobTitleInput value="" onChange={jest.fn()} onSubmit={jest.fn()} />);

    const input = screen.getByPlaceholderText(/e.g., Software Engineer/);
    await user.type(input, 'CEO');

    await waitFor(() => {
      expect(screen.getByText('Chief Executives')).toBeInTheDocument();
    });
  });

  it('submits selected suggestion on click', async () => {
    const onSubmit = jest.fn();
    // ... setup and click test
  });
});

// occupation-selector.spec.tsx
describe('OccupationSelector', () => {
  it('shows best match badge on first result', () => {
    render(
      <OccupationSelector
        occupations={mockOccupations}
        selected={null}
        onSelect={jest.fn()}
        jobTitle="Engineer"
      />
    );

    expect(screen.getByText('Best match')).toBeInTheDocument();
  });

  it('allows selecting "none of these"', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();

    render(
      <OccupationSelector
        occupations={mockOccupations}
        selected={null}
        onSelect={onSelect}
        jobTitle="Unique Role"
      />
    );

    await user.click(screen.getByText('None of these match'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      code: 'none',
      title: 'Unique Role',
    }));
  });
});
```

### Integration Test

```typescript
// job-title.e2e-spec.ts
describe('Job Title Flow (e2e)', () => {
  it('completes full job title selection flow', async () => {
    await page.goto('/futura/job-title');

    // Type job title
    await page.fill('input', 'Software Engineer');
    await page.click('button:has-text("Find matching")');

    // Wait for results
    await page.waitForSelector('text=Software Developers');

    // Select first option
    await page.click('text=Software Developers');

    // Continue
    await page.click('button:has-text("Continue")');

    // Should navigate to chat with params
    await expect(page).toHaveURL(/\/futura\/chat\?jobTitle=Software/);
  });
});
```

---

## Edge Cases

### 1. Very Short Input

```typescript
// Prevent search for < 2 characters
if (query.length < 2) {
  return { occupations: [] };
}
```

### 2. Special Characters

```typescript
// Sanitize input for search
const sanitizedQuery = query
  .replace(/[^\w\s-]/g, '')
  .trim();
```

### 3. No Internet / API Failure

```typescript
// Graceful degradation
if (fetchError) {
  // Allow user to proceed with free text
  return (
    <NoMatchFallback
      jobTitle={jobTitle}
      onBack={handleBack}
      onContinue={handleSkip}
    />
  );
}
```

### 4. Ambiguous Titles

Some titles (e.g., "Manager", "Analyst") match many occupations. Handle by:
- Showing top 5-7 results
- Adding "None of these" option
- Allowing free text proceed

---

## Open Questions

1. **Required vs optional:** Should occupation matching be required or can users always skip?
2. **Confidence threshold:** At what similarity score do we show "no match" vs showing results?
3. **Alternative titles weight:** How much to boost keyword matches vs semantic?
4. **Caching:** Cache popular job title searches?

---

## Dependencies

- **Epic 2:** O*NET data in Pinecone, occupation search service
- **Supabase:** Alternative titles table

---

## Estimated Effort

### V1 (CSV Lookup)

| Task | Estimate |
|------|----------|
| Job title input component (simple) | 0.5 days |
| CSV creation + lookup service | 1 day |
| Backend endpoint | 0.5 days |
| Page routing | 0.5 days |
| Testing | 0.5 days |
| **Total (V1)** | **~3 days** |

### V2 (Full Autocomplete) - Deferred

| Task | Estimate |
|------|----------|
| Autocomplete UI | 1.5 days |
| Occupation selector | 1 day |
| Alternative titles search | 1 day |
| No match fallback | 0.5 days |
| Testing | 1 day |
| **Total (V2 additional)** | **~5 days** |

---

## Implementation Tickets

### JOB-001: Job Titles CSV Creation

**Priority:** P0
**Estimate:** 1 day
**Depends on:** None (can start immediately)

#### Description

Create the job titles CSV file that maps common job titles to O*NET occupation codes.

#### Acceptance Criteria

- [ ] CSV file with columns: `common_title`, `onet_code`, `onet_title`, `confidence`
- [ ] At least 100 common job titles covered
- [ ] Includes variations (e.g., "Software Engineer", "Software Developer", "SWE")
- [ ] Confidence scores reflect match quality (0.0-1.0)
- [ ] Documented methodology for creating mappings

#### Files to Create

```
data/job-titles/
├── job-titles.csv            # Main mapping file
├── README.md                 # Methodology documentation
└── generate-titles.py        # Optional: script to help generate
```

#### CSV Format

```csv
common_title,onet_code,onet_title,confidence
"Software Engineer",15-1252.00,"Software Developers",0.95
"Software Developer",15-1252.00,"Software Developers",0.99
"SWE",15-1252.00,"Software Developers",0.90
"Policy Advisor",13-1199.02,"Policy Analysts",0.95
"Policy Analyst",13-1199.02,"Policy Analysts",0.99
"Data Scientist",15-2051.00,"Data Scientists",0.95
"Nurse",29-1141.00,"Registered Nurses",0.90
"RN",29-1141.00,"Registered Nurses",0.85
"Teacher",25-2021.00,"Elementary School Teachers",0.80
```

#### Data Sources

- O*NET occupation titles
- LinkedIn job title data (if available)
- Common industry variations

---

### JOB-002: Job Title Lookup Service

**Priority:** P0
**Estimate:** 0.5 days
**Depends on:** JOB-001, SETUP-001

#### Description

Implement the backend service that looks up job titles in the CSV/database.

#### Acceptance Criteria

- [ ] `job-titles.service.ts` implements `lookup()` method
- [ ] Case-insensitive matching
- [ ] Fuzzy matching for partial matches
- [ ] Returns O*NET code if found, null otherwise
- [ ] Fast lookup (< 10ms)

#### Files to Create

```
futura-api/src/survey/job-titles/
├── job-titles.module.ts
├── job-titles.service.ts
└── data/
    └── job-titles.json       # Converted from CSV
```

#### Reference Implementation

See `JobTitleLookupService` code block in this document.

#### Lookup Logic

```typescript
// 1. Exact match (case-insensitive)
// 2. Contains match (user input contains known title)
// 3. Fuzzy match (edit distance) - optional for V1
```

#### Testing

- [ ] Exact match works ("Software Engineer" → finds)
- [ ] Case insensitive ("software engineer" → finds)
- [ ] No match returns null
- [ ] Performance is fast

---

### JOB-003: Job Title Input Page

**Priority:** P0
**Estimate:** 1 day
**Depends on:** JOB-002, SETUP-001

#### Description

Build the landing page with simple job title input that routes to chat.

#### Acceptance Criteria

- [ ] `/survey` page shows job title input
- [ ] Text input with placeholder
- [ ] Submit button
- [ ] Validates non-empty
- [ ] Calls lookup service on submit
- [ ] Navigates to chat with `jobTitle` and optional `occupationCode` params
- [ ] Shows brief instructions

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/page.tsx
futura-ui/src/app/[locale]/futura/survey/_components/
├── job-title-input.tsx
└── survey-intro.tsx
```

#### Reference Implementation

See `JobTitleInputSimple` component in this document.

#### User Flow

```
1. User lands on /survey
2. Enters "Policy Analyst"
3. Clicks "Start Survey"
4. Backend looks up → finds 13-1199.02
5. Redirect to /survey/chat?jobTitle=Policy+Analyst&occupationCode=13-1199.02
```

#### Testing

- [ ] Empty input shows validation error
- [ ] Valid input proceeds to chat
- [ ] URL params are correctly set
