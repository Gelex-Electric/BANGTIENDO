export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Predecessor {
  id: number;
  type: DependencyType;
}

export interface Task {
  id: number;
  taskName: string;
  startDate: string;
  endDate: string;
  duration?: number;
  progress: number;
  assignee: string;
  parentId?: number;
  predecessors?: Predecessor[];
  notes?: string;
  source?: string;
  isMilestone?: boolean;
}

export type GanttMode = 'day' | 'week' | 'month';
