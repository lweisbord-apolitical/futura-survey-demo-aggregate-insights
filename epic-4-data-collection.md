# Epic 4: Data Collection UI

**Project:** Task Capture Survey Tool (Futura)
**Epic:** Time Allocation & AI Usage Data Collection
**Status:** V1 Implementation Spec

**Related Docs:**
- [Technical Implementation Plan](./technical-implementation.md)
- [Epic 3: Task Processing](./epic-3-task-processing.md) — provides processed tasks

---

## Overview

This epic covers the UI for collecting time allocation and AI usage data for each task. In V1, users see their extracted tasks in **read-only** mode and provide input on how much time they spend and how they use AI for each.

### V1 Scope

| Feature | V1 Status |
|---------|-----------|
| Display processed tasks | ✅ In scope (read-only) |
| Time allocation input | ✅ In scope |
| AI usage frequency input | ✅ In scope |
| AI usage description | ✅ In scope (optional) |
| Task editing | ❌ Deferred to V2 |
| Task adding/removing | ❌ Deferred to V2 |
| Task reordering | ❌ Deferred to V2 |
| Confidence badges | ❌ Deferred to V2 |

### Goals

1. Display processed tasks (read-only in V1)
2. Collect relative time allocation per task (%)
3. Collect AI usage frequency (5-point scale) per task
4. Collect optional free-text AI usage description
5. Persist data for analysis

### User Flow (V1 Simplified)

```
[Task Processing Complete]
    → Data Collection Screen
        → User sees task list (read-only)
        → User adjusts time allocations (should sum to ~100%)
        → User rates AI usage per task
        → User optionally describes how they use AI
    → [Submit]
```

---

## Frontend Implementation

### File Structure (V1 Simplified)

```
futura-ui/src/app/[locale]/futura/
├── data-collection/
│   └── page.tsx                          # /futura/data-collection route
├── _components/
│   └── data-collection/
│       ├── index.ts                      # Barrel export
│       ├── data-collection-container.tsx # Main container
│       ├── task-list.tsx                 # Task list (read-only)
│       ├── task-card.tsx                 # Individual task card (no edit)
│       ├── time-allocation-input.tsx     # Time % slider/input
│       ├── ai-usage-input.tsx            # AI frequency + description
│       ├── time-balance-indicator.tsx    # Shows total % and balance
│       └── context/
│           ├── data-collection-context.tsx # State management
│           └── data-collection-types.ts    # TypeScript types
```

**Deferred to V2:**
- `task-editor-modal.tsx`
- `add-task-modal.tsx`
- `task-confidence-badge.tsx`

---

### Component Specifications

#### `task-review-container.tsx`

Main wrapper that loads data and provides context.

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TaskReviewProvider } from './context/task-review-context';
import { TaskList } from './task-list';
import { TimeBalanceIndicator } from './time-balance-indicator';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { useTranslations } from 'next-intl';
import type { ProcessedTask } from './context/task-review-types';

interface TaskReviewContainerProps {
  sessionId: string;
  initialTasks: ProcessedTask[];
  jobTitle: string;
  onComplete: (data: TaskReviewData) => void;
}

export function TaskReviewContainer({
  sessionId,
  initialTasks,
  jobTitle,
  onComplete,
}: TaskReviewContainerProps) {
  const t = useTranslations('client.futura.tasks');

  return (
    <TaskReviewProvider
      sessionId={sessionId}
      initialTasks={initialTasks}
      jobTitle={jobTitle}
    >
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-n-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-n-600">
            {t('subtitle')}
          </p>
        </div>

        {/* Time balance indicator */}
        <TimeBalanceIndicator className="mb-6" />

        {/* Task list */}
        <TaskList className="mb-8" />

        {/* Actions */}
        <TaskReviewActions onComplete={onComplete} />
      </div>
    </TaskReviewProvider>
  );
}

function TaskReviewActions({
  onComplete,
}: {
  onComplete: (data: TaskReviewData) => void;
}) {
  const t = useTranslations('client.futura.tasks');
  const { tasks, isValid, getSubmissionData } = useTaskReviewContext();

  const handleSubmit = () => {
    if (isValid) {
      onComplete(getSubmissionData());
    }
  };

  return (
    <div className="flex justify-between items-center border-t border-n-200 pt-6">
      <p className="text-sm text-n-500">
        {tasks.length} {t('task-count', { count: tasks.length })}
      </p>
      <Button
        onClick={handleSubmit}
        disabled={!isValid}
        size="lg"
      >
        {t('submit-button')}
      </Button>
    </div>
  );
}
```

#### `task-list.tsx`

List of task cards with add button.

```typescript
'use client';

import { useState } from 'react';
import { TaskCard } from './task-card';
import { AddTaskModal } from './add-task-modal';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { PlusIcon } from '@apolitical/futura/lib/elements/icons';
import { useTaskReviewContext } from './context/task-review-context';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';

interface TaskListProps {
  className?: string;
}

export function TaskList({ className }: TaskListProps) {
  const t = useTranslations('client.futura.tasks');
  const { tasks, addTask } = useTaskReviewContext();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Sort: low confidence first, then by GWA category
  const sortedTasks = [...tasks].sort((a, b) => {
    // Low confidence first
    if (a.confidence < 0.5 && b.confidence >= 0.5) return -1;
    if (a.confidence >= 0.5 && b.confidence < 0.5) return 1;

    // Then by category
    return a.gwaCategory.localeCompare(b.gwaCategory);
  });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Low confidence section */}
      {tasks.some(t => t.confidence < 0.5) && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {t('needs-review')}
          </h3>
        </div>
      )}

      {/* Task cards */}
      {sortedTasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
        />
      ))}

      {/* Add task button */}
      <Button
        variant="outline"
        onClick={() => setIsAddModalOpen(true)}
        className="w-full border-dashed"
      >
        <PlusIcon className="h-4 w-4 mr-2" />
        {t('add-task')}
      </Button>

      {/* Add modal */}
      <AddTaskModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAdd={(task) => {
          addTask(task);
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
}
```

#### `task-card.tsx`

Individual task card with all inputs.

```typescript
'use client';

import { useState } from 'react';
import { Card } from '@apolitical/futura/lib/elements/ui/card';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { TimeAllocationInput } from './time-allocation-input';
import { AIUsageInput } from './ai-usage-input';
import { TaskConfidenceBadge } from './task-confidence-badge';
import { TaskEditorModal } from './task-editor-modal';
import { EditIcon, TrashIcon, ChevronDownIcon } from '@apolitical/futura/lib/elements/icons';
import { useTaskReviewContext } from './context/task-review-context';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';
import type { ReviewTask } from './context/task-review-types';

interface TaskCardProps {
  task: ReviewTask;
  index: number;
}

export function TaskCard({ task, index }: TaskCardProps) {
  const t = useTranslations('client.futura.tasks');
  const { updateTask, removeTask } = useTaskReviewContext();
  const [isExpanded, setIsExpanded] = useState(task.confidence < 0.5);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleTimeChange = (value: number) => {
    updateTask(task.id, { timePercentage: value });
  };

  const handleAIUsageChange = (frequency: AIFrequency) => {
    updateTask(task.id, { aiUsage: { ...task.aiUsage, frequency } });
  };

  const handleAIDescriptionChange = (description: string) => {
    updateTask(task.id, { aiUsage: { ...task.aiUsage, description } });
  };

  const handleDescriptionEdit = (newDescription: string) => {
    updateTask(task.id, { description: newDescription });
    setIsEditModalOpen(false);
  };

  return (
    <Card className={cn(
      'p-4 transition-all',
      task.confidence < 0.5 && 'border-amber-300 bg-amber-50/50',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <TaskConfidenceBadge confidence={task.confidence} />
            <span className="text-xs text-n-400 uppercase">
              {t(`gwa.${task.gwaCategory}`)}
            </span>
          </div>
          <p className="text-n-900 font-medium">
            {task.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsEditModalOpen(true)}
            className="h-8 w-8"
          >
            <EditIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeTask(task.id)}
            className="h-8 w-8 text-red-500 hover:text-red-700"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Time allocation */}
      <div className="mb-4">
        <TimeAllocationInput
          value={task.timePercentage}
          onChange={handleTimeChange}
        />
      </div>

      {/* Expand/collapse for AI usage */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-n-600 hover:text-n-900"
      >
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
        {t('ai-usage-section')}
      </button>

      {/* AI usage (collapsible) */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-n-200">
          <AIUsageInput
            frequency={task.aiUsage.frequency}
            description={task.aiUsage.description}
            onFrequencyChange={handleAIUsageChange}
            onDescriptionChange={handleAIDescriptionChange}
          />
        </div>
      )}

      {/* Edit modal */}
      <TaskEditorModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        task={task}
        onSave={handleDescriptionEdit}
      />
    </Card>
  );
}
```

#### `time-allocation-input.tsx`

Slider + number input for time percentage.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@apolitical/futura/lib/elements/ui/slider';
import { Input } from '@apolitical/futura/lib/elements/ui/input';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';

interface TimeAllocationInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function TimeAllocationInput({
  value,
  onChange,
  className,
}: TimeAllocationInputProps) {
  const t = useTranslations('client.futura.tasks.time');
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleSliderChange = (values: number[]) => {
    const newValue = values[0];
    setLocalValue(String(newValue));
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue);

    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onChange(numValue);
    }
  };

  const handleInputBlur = () => {
    // Normalize value on blur
    const numValue = parseInt(localValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      setLocalValue('0');
      onChange(0);
    } else if (numValue > 100) {
      setLocalValue('100');
      onChange(100);
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span className="text-sm text-n-600 whitespace-nowrap w-24">
        {t('label')}
      </span>

      <Slider
        value={[value]}
        onValueChange={handleSliderChange}
        max={100}
        step={5}
        className="flex-1"
      />

      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={0}
          max={100}
          className="w-16 text-center"
        />
        <span className="text-sm text-n-600">%</span>
      </div>
    </div>
  );
}
```

#### `ai-usage-input.tsx`

5-point scale + free text for AI usage.

```typescript
'use client';

import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@apolitical/futura/lib/elements/ui/radio-group';
import { Textarea } from '@apolitical/futura/lib/elements/ui/textarea';
import { Label } from '@apolitical/futura/lib/elements/ui/label';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';
import type { AIFrequency } from './context/task-review-types';

interface AIUsageInputProps {
  frequency: AIFrequency;
  description?: string;
  onFrequencyChange: (frequency: AIFrequency) => void;
  onDescriptionChange: (description: string) => void;
  className?: string;
}

const FREQUENCY_OPTIONS: AIFrequency[] = [
  'never',
  'rarely',
  'sometimes',
  'often',
  'always',
];

export function AIUsageInput({
  frequency,
  description,
  onFrequencyChange,
  onDescriptionChange,
  className,
}: AIUsageInputProps) {
  const t = useTranslations('client.futura.tasks.ai');
  const [showDescription, setShowDescription] = useState(
    frequency !== 'never' && (description?.length || 0) > 0
  );

  const handleFrequencyChange = (value: string) => {
    const newFrequency = value as AIFrequency;
    onFrequencyChange(newFrequency);

    // Show description field if using AI
    if (newFrequency !== 'never') {
      setShowDescription(true);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Question */}
      <p className="text-sm font-medium text-n-700">
        {t('question')}
      </p>

      {/* Frequency scale */}
      <RadioGroup
        value={frequency}
        onValueChange={handleFrequencyChange}
        className="flex flex-wrap gap-2"
      >
        {FREQUENCY_OPTIONS.map((option) => (
          <div key={option}>
            <RadioGroupItem
              value={option}
              id={`ai-${option}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`ai-${option}`}
              className={cn(
                'px-4 py-2 rounded-full border cursor-pointer transition-all',
                'text-sm font-medium',
                frequency === option
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-n-700 border-n-300 hover:border-primary'
              )}
            >
              {t(`frequency.${option}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Description (shown when not "never") */}
      {showDescription && frequency !== 'never' && (
        <div className="space-y-2">
          <Label htmlFor="ai-description" className="text-sm text-n-600">
            {t('description-label')}
          </Label>
          <Textarea
            id="ai-description"
            value={description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t('description-placeholder')}
            rows={3}
            className="resize-none"
          />
        </div>
      )}

      {/* Not sure option */}
      {frequency === 'never' && (
        <button
          onClick={() => onFrequencyChange('not_sure')}
          className="text-sm text-n-500 hover:text-n-700 underline"
        >
          {t('not-sure')}
        </button>
      )}
    </div>
  );
}
```

#### `time-balance-indicator.tsx`

Shows total time % and visual balance indicator.

```typescript
'use client';

import { useMemo } from 'react';
import { Progress } from '@apolitical/futura/lib/elements/ui/progress';
import { useTaskReviewContext } from './context/task-review-context';
import { useTranslations } from 'next-intl';
import { cn } from '@apolitical/futura/lib/utils/utils';

interface TimeBalanceIndicatorProps {
  className?: string;
}

export function TimeBalanceIndicator({ className }: TimeBalanceIndicatorProps) {
  const t = useTranslations('client.futura.tasks.time-balance');
  const { tasks } = useTaskReviewContext();

  const total = useMemo(
    () => tasks.reduce((sum, task) => sum + task.timePercentage, 0),
    [tasks]
  );

  const status = useMemo(() => {
    if (total < 90) return 'under';
    if (total > 110) return 'over';
    return 'balanced';
  }, [total]);

  const statusColor = {
    under: 'text-amber-600',
    over: 'text-red-600',
    balanced: 'text-green-600',
  };

  const progressColor = {
    under: 'bg-amber-500',
    over: 'bg-red-500',
    balanced: 'bg-green-500',
  };

  return (
    <div className={cn('rounded-lg border border-n-200 p-4 bg-n-50', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-n-700">
          {t('label')}
        </span>
        <span className={cn('text-lg font-bold', statusColor[status])}>
          {total}%
        </span>
      </div>

      <Progress
        value={Math.min(total, 100)}
        className="h-2"
        indicatorClassName={progressColor[status]}
      />

      <p className="mt-2 text-xs text-n-500">
        {status === 'balanced' && t('status.balanced')}
        {status === 'under' && t('status.under', { remaining: 100 - total })}
        {status === 'over' && t('status.over', { excess: total - 100 })}
      </p>
    </div>
  );
}
```

#### `task-editor-modal.tsx`

Modal for editing task description.

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@apolitical/futura/lib/elements/ui/dialog';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { Textarea } from '@apolitical/futura/lib/elements/ui/textarea';
import { Label } from '@apolitical/futura/lib/elements/ui/label';
import { useTranslations } from 'next-intl';
import type { ReviewTask } from './context/task-review-types';

interface TaskEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ReviewTask;
  onSave: (description: string) => void;
}

export function TaskEditorModal({
  open,
  onOpenChange,
  task,
  onSave,
}: TaskEditorModalProps) {
  const t = useTranslations('client.futura.tasks.editor');
  const [description, setDescription] = useState(task.description);

  const handleSave = () => {
    if (description.trim()) {
      onSave(description.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-description">{t('label')}</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t('placeholder')}
            />
          </div>

          {/* Original text reference */}
          {task.userDescription !== task.description && (
            <div className="text-xs text-n-500 bg-n-50 p-2 rounded">
              <span className="font-medium">{t('original')}:</span>{' '}
              {task.userDescription}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!description.trim()}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### `add-task-modal.tsx`

Modal for adding a new task.

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@apolitical/futura/lib/elements/ui/dialog';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { Textarea } from '@apolitical/futura/lib/elements/ui/textarea';
import { Label } from '@apolitical/futura/lib/elements/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@apolitical/futura/lib/elements/ui/select';
import { useTranslations } from 'next-intl';
import type { GWACategory, NewTask } from './context/task-review-types';

const GWA_CATEGORIES: GWACategory[] = [
  'informationInput',
  'mentalProcesses',
  'workOutput',
  'interactingWithOthers',
];

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: NewTask) => void;
}

export function AddTaskModal({ open, onOpenChange, onAdd }: AddTaskModalProps) {
  const t = useTranslations('client.futura.tasks.add');
  const [description, setDescription] = useState('');
  const [gwaCategory, setGwaCategory] = useState<GWACategory>('workOutput');

  const handleAdd = () => {
    if (description.trim()) {
      onAdd({
        description: description.trim(),
        gwaCategory,
        timePercentage: 5,
        aiUsage: { frequency: 'never' },
      });
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-task-description">{t('description-label')}</Label>
            <Textarea
              id="new-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('description-placeholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-task-category">{t('category-label')}</Label>
            <Select value={gwaCategory} onValueChange={(v) => setGwaCategory(v as GWACategory)}>
              <SelectTrigger id="new-task-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GWA_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`gwa.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={!description.trim()}>
            {t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Context & State Management

#### `task-review-types.ts`

```typescript
export type GWACategory =
  | 'informationInput'
  | 'mentalProcesses'
  | 'workOutput'
  | 'interactingWithOthers';

export type AIFrequency =
  | 'never'
  | 'rarely'
  | 'sometimes'
  | 'often'
  | 'always'
  | 'not_sure';

export interface AIUsage {
  frequency: AIFrequency;
  description?: string;
}

export interface ProcessedTask {
  id: string;
  userDescription: string;
  normalizedDescription: string;
  source: 'extracted' | 'suggestion';
  confidence: number;
  confidenceReasons: string[];
  gwaCategory: GWACategory;
  onetMatches: ONetMatch[];
}

export interface ONetMatch {
  taskId: string;
  statement: string;
  similarity: number;
  occupationCode: string;
  aiExposureScore: number;
}

export interface ReviewTask {
  id: string;
  description: string;
  userDescription: string;
  gwaCategory: GWACategory;
  confidence: number;
  timePercentage: number;
  aiUsage: AIUsage;
  onetMatches: ONetMatch[];
  source: 'extracted' | 'suggestion' | 'manual';
}

export interface NewTask {
  description: string;
  gwaCategory: GWACategory;
  timePercentage: number;
  aiUsage: AIUsage;
}

export interface TaskReviewData {
  sessionId: string;
  jobTitle: string;
  tasks: ReviewTask[];
  totalTime: number;
  submittedAt: string;
}

export interface TaskReviewContextType {
  sessionId: string;
  jobTitle: string;
  tasks: ReviewTask[];

  // Validation
  isValid: boolean;
  validationErrors: string[];

  // Actions
  updateTask: (id: string, updates: Partial<ReviewTask>) => void;
  removeTask: (id: string) => void;
  addTask: (task: NewTask) => void;
  reorderTasks: (fromIndex: number, toIndex: number) => void;

  // Submission
  getSubmissionData: () => TaskReviewData;
}
```

#### `task-review-schemas.ts`

```typescript
import { z } from 'zod';

export const aiFrequencySchema = z.enum([
  'never',
  'rarely',
  'sometimes',
  'often',
  'always',
  'not_sure',
]);

export const aiUsageSchema = z.object({
  frequency: aiFrequencySchema,
  description: z.string().optional(),
});

export const gwaCategory Schema = z.enum([
  'informationInput',
  'mentalProcesses',
  'workOutput',
  'interactingWithOthers',
]);

export const reviewTaskSchema = z.object({
  id: z.string(),
  description: z.string().min(3, 'Task description is required'),
  userDescription: z.string(),
  gwaCategory: gwaCategorySchema,
  confidence: z.number().min(0).max(1),
  timePercentage: z.number().min(0).max(100),
  aiUsage: aiUsageSchema,
  onetMatches: z.array(z.object({
    taskId: z.string(),
    statement: z.string(),
    similarity: z.number(),
    occupationCode: z.string(),
    aiExposureScore: z.number(),
  })),
  source: z.enum(['extracted', 'suggestion', 'manual']),
});

export const taskReviewDataSchema = z.object({
  sessionId: z.string(),
  jobTitle: z.string(),
  tasks: z.array(reviewTaskSchema).min(1, 'At least one task is required'),
  totalTime: z.number(),
  submittedAt: z.string(),
});

export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>;
export type TaskReviewDataInput = z.infer<typeof taskReviewDataSchema>;
```

#### `task-review-context.tsx`

```typescript
'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  TaskReviewContextType,
  ReviewTask,
  ProcessedTask,
  NewTask,
  TaskReviewData,
} from './task-review-types';

const TaskReviewContext = createContext<TaskReviewContextType | undefined>(undefined);

interface TaskReviewProviderProps {
  children: React.ReactNode;
  sessionId: string;
  initialTasks: ProcessedTask[];
  jobTitle: string;
}

export function TaskReviewProvider({
  children,
  sessionId,
  initialTasks,
  jobTitle,
}: TaskReviewProviderProps) {
  // Convert processed tasks to review tasks
  const [tasks, setTasks] = useState<ReviewTask[]>(() =>
    initialTasks.map(processedToReviewTask)
  );

  const updateTask = useCallback((id: string, updates: Partial<ReviewTask>) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      )
    );
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const addTask = useCallback((newTask: NewTask) => {
    const reviewTask: ReviewTask = {
      id: uuidv4(),
      description: newTask.description,
      userDescription: newTask.description,
      gwaCategory: newTask.gwaCategory,
      confidence: 1.0, // User-added tasks are high confidence
      timePercentage: newTask.timePercentage,
      aiUsage: newTask.aiUsage,
      onetMatches: [],
      source: 'manual',
    };
    setTasks((prev) => [...prev, reviewTask]);
  }, []);

  const reorderTasks = useCallback((fromIndex: number, toIndex: number) => {
    setTasks((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  // Validation
  const { isValid, validationErrors } = useMemo(() => {
    const errors: string[] = [];

    if (tasks.length === 0) {
      errors.push('At least one task is required');
    }

    const totalTime = tasks.reduce((sum, t) => sum + t.timePercentage, 0);
    if (totalTime < 90) {
      errors.push(`Time allocation is only ${totalTime}%. Should be close to 100%.`);
    }
    if (totalTime > 110) {
      errors.push(`Time allocation is ${totalTime}%. Should be close to 100%.`);
    }

    const emptyDescriptions = tasks.filter((t) => t.description.trim().length < 3);
    if (emptyDescriptions.length > 0) {
      errors.push('Some tasks have missing or very short descriptions');
    }

    return {
      isValid: errors.length === 0,
      validationErrors: errors,
    };
  }, [tasks]);

  const getSubmissionData = useCallback((): TaskReviewData => {
    return {
      sessionId,
      jobTitle,
      tasks,
      totalTime: tasks.reduce((sum, t) => sum + t.timePercentage, 0),
      submittedAt: new Date().toISOString(),
    };
  }, [sessionId, jobTitle, tasks]);

  const value = useMemo<TaskReviewContextType>(
    () => ({
      sessionId,
      jobTitle,
      tasks,
      isValid,
      validationErrors,
      updateTask,
      removeTask,
      addTask,
      reorderTasks,
      getSubmissionData,
    }),
    [
      sessionId,
      jobTitle,
      tasks,
      isValid,
      validationErrors,
      updateTask,
      removeTask,
      addTask,
      reorderTasks,
      getSubmissionData,
    ]
  );

  return (
    <TaskReviewContext.Provider value={value}>
      {children}
    </TaskReviewContext.Provider>
  );
}

export function useTaskReviewContext() {
  const context = useContext(TaskReviewContext);
  if (!context) {
    throw new Error('useTaskReviewContext must be used within TaskReviewProvider');
  }
  return context;
}

// Helper to convert processed task to review task
function processedToReviewTask(task: ProcessedTask): ReviewTask {
  return {
    id: task.id,
    description: task.normalizedDescription,
    userDescription: task.userDescription,
    gwaCategory: task.gwaCategory,
    confidence: task.confidence,
    timePercentage: 0, // User must fill in
    aiUsage: { frequency: 'never' },
    onetMatches: task.onetMatches,
    source: task.source,
  };
}
```

---

## Backend Implementation

### Submit Endpoint

```typescript
// backend/v2/apps/futura-api/src/task-responses/task-responses.controller.ts
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { taskResponses } from '@apolitical/contracts';
import { TaskResponsesService } from './task-responses.service';

@Controller()
export class TaskResponsesController {
  constructor(private readonly service: TaskResponsesService) {}

  @TsRestHandler(taskResponses.submit)
  async submit() {
    return tsRestHandler(taskResponses.submit, async ({ body }) => {
      const result = await this.service.submit(body);
      return { status: 201, body: result };
    });
  }
}
```

### Service

```typescript
// task-responses.service.ts
import { Injectable } from '@nestjs/common';
import { FuturaDbService } from '../futura-db/futura-db.service';
import { ONetService } from '../onet/onet.service';
import type { TaskReviewData, SubmitResponse } from './dto';

@Injectable()
export class TaskResponsesService {
  constructor(
    private readonly db: FuturaDbService,
    private readonly onet: ONetService,
  ) {}

  async submit(data: TaskReviewData): Promise<SubmitResponse> {
    // 1. Create assessment record
    const assessment = await this.db.createAssessment({
      sessionId: data.sessionId,
      jobTitle: data.jobTitle,
      totalTime: data.totalTime,
      submittedAt: data.submittedAt,
    });

    // 2. Run final O*NET matching for any user-edited tasks
    const tasksWithMatches = await this.enrichTasks(data.tasks);

    // 3. Store task responses
    await this.db.createTaskResponses(
      assessment.id,
      tasksWithMatches.map((task) => ({
        taskId: task.id,
        userDescription: task.userDescription,
        normalizedDescription: task.description,
        gwaCategory: task.gwaCategory,
        timePercentage: task.timePercentage,
        aiFrequency: task.aiUsage.frequency,
        aiDescription: task.aiUsage.description,
        onetTaskId: task.onetMatches[0]?.taskId,
        onetSimilarity: task.onetMatches[0]?.similarity,
        aiExposureScore: task.onetMatches[0]?.aiExposureScore,
        source: task.source,
      }))
    );

    // 4. Calculate aggregate scores
    const aggregateScores = this.calculateAggregateScores(tasksWithMatches);

    // 5. Update assessment with scores
    await this.db.updateAssessment(assessment.id, {
      aggregateAiExposure: aggregateScores.weightedAiExposure,
      gwaCoverage: aggregateScores.gwaCoverage,
    });

    return {
      assessmentId: assessment.id,
      aggregateScores,
    };
  }

  private async enrichTasks(tasks: ReviewTask[]): Promise<ReviewTask[]> {
    // Re-match tasks that were manually added or edited
    const tasksToMatch = tasks.filter(
      (t) => t.source === 'manual' || t.onetMatches.length === 0
    );

    if (tasksToMatch.length === 0) {
      return tasks;
    }

    const matches = await this.onet.matchTasks({
      userTasks: tasksToMatch.map((t) => ({
        id: t.id,
        description: t.description,
      })),
    });

    // Merge matches back
    return tasks.map((task) => {
      const match = matches.matches.find((m) => m.userTaskId === task.id);
      if (match) {
        return { ...task, onetMatches: match.onetMatches };
      }
      return task;
    });
  }

  private calculateAggregateScores(tasks: ReviewTask[]): AggregateScores {
    // Weighted average of AI exposure by time allocation
    let weightedExposure = 0;
    let totalWeight = 0;

    for (const task of tasks) {
      const exposure = task.onetMatches[0]?.aiExposureScore ?? 0.5;
      const weight = task.timePercentage / 100;
      weightedExposure += exposure * weight;
      totalWeight += weight;
    }

    const avgExposure = totalWeight > 0 ? weightedExposure / totalWeight : 0.5;

    // GWA coverage
    const gwaCounts: Record<string, number> = {};
    for (const task of tasks) {
      gwaCounts[task.gwaCategory] = (gwaCounts[task.gwaCategory] || 0) + 1;
    }

    return {
      weightedAiExposure: avgExposure,
      gwaCoverage: gwaCounts,
      taskCount: tasks.length,
    };
  }
}

interface AggregateScores {
  weightedAiExposure: number;
  gwaCoverage: Record<string, number>;
  taskCount: number;
}
```

---

## Database Schema

### New Tables

```sql
-- Task response assessment (parent record)
CREATE TABLE task_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  job_title TEXT NOT NULL,
  occupation_code TEXT,
  total_time_allocated DECIMAL(5,2),
  aggregate_ai_exposure DECIMAL(4,3),
  gwa_coverage JSONB,
  submitted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual task responses
CREATE TABLE task_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES task_assessments(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  user_description TEXT NOT NULL,
  normalized_description TEXT NOT NULL,
  gwa_category TEXT NOT NULL,
  time_percentage DECIMAL(5,2) NOT NULL,
  ai_frequency TEXT NOT NULL,
  ai_description TEXT,
  onet_task_id TEXT,
  onet_similarity DECIMAL(4,3),
  ai_exposure_score DECIMAL(4,3),
  source TEXT NOT NULL, -- 'extracted', 'suggestion', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_task_assessments_session ON task_assessments(session_id);
CREATE INDEX idx_task_assessments_user ON task_assessments(user_id);
CREATE INDEX idx_task_responses_assessment ON task_responses(assessment_id);
CREATE INDEX idx_task_responses_gwa ON task_responses(gwa_category);
```

### Prisma Schema

```prisma
// prisma/schema.prisma

model TaskAssessment {
  id                  String   @id @default(uuid())
  sessionId           String   @map("session_id")
  userId              String?  @map("user_id")
  jobTitle            String   @map("job_title")
  occupationCode      String?  @map("occupation_code")
  totalTimeAllocated  Decimal? @map("total_time_allocated") @db.Decimal(5, 2)
  aggregateAiExposure Decimal? @map("aggregate_ai_exposure") @db.Decimal(4, 3)
  gwaCoverage         Json?    @map("gwa_coverage")
  submittedAt         DateTime @map("submitted_at")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  taskResponses TaskResponse[]

  @@index([sessionId])
  @@index([userId])
  @@map("task_assessments")
}

model TaskResponse {
  id                    String   @id @default(uuid())
  assessmentId          String   @map("assessment_id")
  taskId                String   @map("task_id")
  userDescription       String   @map("user_description")
  normalizedDescription String   @map("normalized_description")
  gwaCategory           String   @map("gwa_category")
  timePercentage        Decimal  @map("time_percentage") @db.Decimal(5, 2)
  aiFrequency           String   @map("ai_frequency")
  aiDescription         String?  @map("ai_description")
  onetTaskId            String?  @map("onet_task_id")
  onetSimilarity        Decimal? @map("onet_similarity") @db.Decimal(4, 3)
  aiExposureScore       Decimal? @map("ai_exposure_score") @db.Decimal(4, 3)
  source                String
  createdAt             DateTime @default(now()) @map("created_at")

  assessment TaskAssessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)

  @@index([assessmentId])
  @@index([gwaCategory])
  @@map("task_responses")
}
```

---

## API Contract

```typescript
// backend/v2/libs/contracts/src/apis/futura-api/task-responses/task-responses.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const aiUsageSchema = z.object({
  frequency: z.enum(['never', 'rarely', 'sometimes', 'often', 'always', 'not_sure']),
  description: z.string().optional(),
});

const reviewTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  userDescription: z.string(),
  gwaCategory: z.enum([
    'informationInput',
    'mentalProcesses',
    'workOutput',
    'interactingWithOthers',
  ]),
  confidence: z.number(),
  timePercentage: z.number(),
  aiUsage: aiUsageSchema,
  onetMatches: z.array(z.object({
    taskId: z.string(),
    statement: z.string(),
    similarity: z.number(),
    occupationCode: z.string(),
    aiExposureScore: z.number(),
  })),
  source: z.enum(['extracted', 'suggestion', 'manual']),
});

export const taskResponses = c.router({
  submit: {
    method: 'POST',
    path: '/task-responses/submit',
    body: z.object({
      sessionId: z.string(),
      jobTitle: z.string(),
      tasks: z.array(reviewTaskSchema),
      totalTime: z.number(),
      submittedAt: z.string(),
    }),
    responses: {
      201: z.object({
        assessmentId: z.string(),
        aggregateScores: z.object({
          weightedAiExposure: z.number(),
          gwaCoverage: z.record(z.number()),
          taskCount: z.number(),
        }),
      }),
      400: z.object({ message: z.string() }),
    },
    summary: 'Submit task review data',
  },
});
```

---

## Translation Keys

```json
// messages/en.json
{
  "client": {
    "futura": {
      "tasks": {
        "title": "Review Your Tasks",
        "subtitle": "Adjust the list, set time allocations, and tell us about AI usage",
        "task-count": "{count, plural, one {# task} other {# tasks}}",
        "needs-review": "Please review these tasks",
        "add-task": "Add another task",
        "submit-button": "Continue",

        "gwa": {
          "informationInput": "Information Gathering",
          "mentalProcesses": "Analysis & Decisions",
          "workOutput": "Creating & Producing",
          "interactingWithOthers": "Working with People"
        },

        "time": {
          "label": "Time spent"
        },

        "time-balance": {
          "label": "Total time allocation",
          "status": {
            "balanced": "Your time adds up correctly",
            "under": "Add {remaining}% more to reach 100%",
            "over": "You're {excess}% over 100%"
          }
        },

        "ai": {
          "question": "Do you use AI tools for this task?",
          "frequency": {
            "never": "Never",
            "rarely": "Rarely",
            "sometimes": "Sometimes",
            "often": "Often",
            "always": "Always"
          },
          "not-sure": "I'm not sure",
          "description-label": "How do you use AI for this? (optional)",
          "description-placeholder": "e.g., I use ChatGPT to help draft initial outlines..."
        },

        "ai-usage-section": "AI usage",

        "editor": {
          "title": "Edit Task",
          "label": "Task description",
          "placeholder": "Describe what you do...",
          "original": "Original",
          "cancel": "Cancel",
          "save": "Save"
        },

        "add": {
          "title": "Add a Task",
          "description-label": "What do you do?",
          "description-placeholder": "Describe a task you do at work...",
          "category-label": "Category",
          "cancel": "Cancel",
          "add": "Add Task"
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
// task-card.spec.tsx
describe('TaskCard', () => {
  it('renders task with time and AI inputs', () => {
    render(
      <TaskReviewProvider {...mockProps}>
        <TaskCard task={mockTask} index={0} />
      </TaskReviewProvider>
    );

    expect(screen.getByText(mockTask.description)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('updates time allocation on slider change', async () => {
    const user = userEvent.setup();
    const { updateTask } = renderWithContext(<TaskCard task={mockTask} index={0} />);

    const slider = screen.getByRole('slider');
    // Simulate slider change
    fireEvent.change(slider, { target: { value: 25 } });

    expect(updateTask).toHaveBeenCalledWith(mockTask.id, { timePercentage: 25 });
  });
});

// time-balance-indicator.spec.tsx
describe('TimeBalanceIndicator', () => {
  it('shows balanced status when total is 100', () => {
    render(
      <TaskReviewProvider {...mockPropsWithTotal100}>
        <TimeBalanceIndicator />
      </TaskReviewProvider>
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/adds up correctly/)).toBeInTheDocument();
  });

  it('shows warning when under 90%', () => {
    render(
      <TaskReviewProvider {...mockPropsWithTotal70}>
        <TimeBalanceIndicator />
      </TaskReviewProvider>
    );

    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText(/Add 30% more/)).toBeInTheDocument();
  });
});
```

---

## Open Questions

1. **Time allocation enforcement:** Hard require 100% or allow flexibility (90-110%)?
2. **AI usage required:** Make AI frequency required for each task, or optional?
3. **Task minimum:** Require minimum number of tasks before submission?
4. **Auto-save:** Save progress to localStorage/server as user fills in?

---

## Dependencies

- **Epic 3:** Task processing output (ProcessedTask[])
- **Epic 2:** O*NET service for re-matching edited tasks

---

## Estimated Effort

### V1 (Read-only Display)

| Task | Estimate |
|------|----------|
| Data collection container & list | 1 day |
| Task card (read-only, no edit) | 1 day |
| Time allocation input | 0.5 days |
| AI usage input | 1 day |
| Time balance indicator | 0.5 days |
| Context & state | 1 day |
| Backend submit endpoint | 1 day |
| Database schema | 0.5 days |
| Testing | 1 day |
| i18n | 0.5 days |
| **Total (V1)** | **~8 days (~1.5 weeks)** |

### V2 (Task Editing) - Deferred

| Task | Estimate |
|------|----------|
| Task editor modal | 1 day |
| Add task modal | 1 day |
| Confidence badges | 0.5 days |
| Task reordering (drag/drop) | 1 day |
| **Total (V2 additional)** | **~3.5 days** |

---

## Implementation Tickets

### DATA-001: Data Collection Container & Layout

**Priority:** P0
**Estimate:** 1 day
**Depends on:** SETUP-001, PROC-005

#### Description

Build the main container component that displays processed tasks and provides the data collection layout.

#### Acceptance Criteria

- [ ] `data-collection-container.tsx` renders full page layout
- [ ] Receives processed tasks from Epic 3 (via URL params or context)
- [ ] Displays task list with scrollable area
- [ ] Shows time balance indicator at top
- [ ] Submit button at bottom (disabled until valid)
- [ ] Loading state while fetching tasks

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/tasks/page.tsx
futura-ui/src/app/[locale]/futura/survey/_components/data-collection/
├── data-collection-container.tsx
├── data-collection-header.tsx
└── index.ts
```

#### Reference Implementation

See component specifications in this document.

#### Testing

- [ ] Renders task list from props/context
- [ ] Shows loading state
- [ ] Submit button enables when all tasks have time %

---

### DATA-002: Task Card Component (Read-only V1)

**Priority:** P0
**Estimate:** 1 day
**Depends on:** DATA-001

#### Description

Build the individual task card that displays task description and houses input controls.

#### Acceptance Criteria

- [ ] `task-card.tsx` displays task description (read-only in V1)
- [ ] Shows GWA category badge
- [ ] Houses time allocation input
- [ ] Houses AI usage input
- [ ] Expandable for AI usage description
- [ ] Visual hierarchy (task text prominent)

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/data-collection/
├── task-card.tsx
└── gwa-category-badge.tsx
```

#### Reference Implementation

See `TaskCard` component specification in this document.

#### Testing

- [ ] Displays task description correctly
- [ ] GWA badge shows correct category color
- [ ] Inputs are accessible
- [ ] Card is not editable (V1)

---

### DATA-003: Time Allocation Input

**Priority:** P0
**Estimate:** 0.5 days
**Depends on:** DATA-002

#### Description

Build the slider/input component for time allocation percentage per task.

#### Acceptance Criteria

- [ ] `time-allocation-input.tsx` renders slider + percentage display
- [ ] Values 0-100 in 5% increments
- [ ] Updates parent state on change
- [ ] Shows percentage as number
- [ ] Accessible (keyboard, ARIA)

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/data-collection/
└── time-allocation-input.tsx
```

#### Reference Implementation

See `TimeAllocationInput` component specification in this document.

#### Testing

- [ ] Slider changes value
- [ ] Step increment is 5%
- [ ] Value updates parent state

---

### DATA-004: AI Usage Input & Time Balance Indicator

**Priority:** P0
**Estimate:** 1.5 days
**Depends on:** DATA-002

#### Description

Build the AI usage frequency selector, optional description field, and the time balance indicator.

#### Acceptance Criteria

**AI Usage Input:**
- [ ] `ai-usage-input.tsx` renders 5-point scale selector
- [ ] Options: Never, Rarely, Sometimes, Often, Always
- [ ] Radio button or segmented control style
- [ ] Expandable text area for description (optional)
- [ ] Character limit on description (500)

**Time Balance Indicator:**
- [ ] `time-balance-indicator.tsx` shows total percentage
- [ ] Visual feedback: green (90-110%), yellow (70-130%), red (outside)
- [ ] Message if far from 100%

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/data-collection/
├── ai-usage-input.tsx
└── time-balance-indicator.tsx
```

#### Reference Implementation

See `AIUsageInput` and `TimeBalanceIndicator` component specifications.

#### Testing

- [ ] All 5 AI usage options selectable
- [ ] Description field expands
- [ ] Time balance shows correct total
- [ ] Colors change based on total

---

### DATA-005: Backend Submit Endpoint & Database

**Priority:** P0
**Estimate:** 1.5 days
**Depends on:** SETUP-001

#### Description

Build the backend endpoint to receive and store survey responses.

#### Acceptance Criteria

- [ ] `responses.controller.ts` exposes `POST /api/futura-api/survey/responses/submit`
- [ ] `responses.service.ts` validates and stores data
- [ ] Creates `task_assessments` parent record
- [ ] Creates `task_responses` for each task
- [ ] Returns submission ID on success
- [ ] Validates time % sums reasonably (~100%)

#### Files to Create

```
futura-api/src/survey/responses/
├── responses.module.ts
├── responses.controller.ts
├── responses.service.ts
└── dto/
    └── submit-responses.dto.ts
```

#### Database Tables

```sql
-- task_assessments (see technical-implementation.md)
-- task_responses (see technical-implementation.md)
```

#### API Contract

```
backend/v2/libs/contracts/src/apis/futura-api/survey/responses.contract.ts
```

#### Testing

- [ ] Endpoint returns 200 with valid payload
- [ ] Records created in database
- [ ] Invalid payload returns 400
