import React from 'react';
import { Lock } from 'lucide-react';
import type { Project } from '@/shared/types/models';
import { Select } from '@/shared/ui';

interface ProjectSelectProps {
  projects: Project[];
  selectedProjectId: number | null;
  onSelect: (projectId: number) => void;
  isLocked?: boolean;
}

export const ProjectSelect: React.FC<ProjectSelectProps> = ({
  projects,
  selectedProjectId,
  onSelect,
  isLocked = false,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-ink-normal/80 dark:text-gray-300">
        <span>پروژه</span>
        {isLocked && (
          <span className="flex items-center gap-1 text-[#E0195B]">
            <Lock className="w-3.5 h-3.5" />
            <span>قفل</span>
          </span>
        )}
      </div>

      <Select
        disabled={isLocked}
        value={selectedProjectId || ''}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        <option value="" disabled>
          {projects.length === 0 ? 'پروژه‌ای اختصاص نیافته' : 'انتخاب پروژه...'}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </div>
  );
};

