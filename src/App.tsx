/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  ChevronRight, 
  ChevronDown,
  User,
  X,
  Layout,
  Briefcase,
  Menu,
  Info,
  Flag
} from 'lucide-react';
import { Task, GanttMode, Predecessor, DependencyType } from './types';
import { PROJECTS } from './constants';

export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState('BT01');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [ganttMode, setGanttMode] = useState<GanttMode>('month');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Fetch and parse CSV data based on selected project
useEffect(() => {
  fetch(`${import.meta.env.BASE_URL}${selectedProjectId}.csv`)
    .then(response => {
      if (!response.ok) throw new Error(`Failed to fetch ${import.meta.env.BASE_URL}${selectedProjectId}.csv`);
      return response.text();
      })
      .then(csvData => {
        Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedTasks = results.data.map((row: any) => {
              // Robust predecessors parsing
              let preds: Predecessor[] | undefined = undefined;
              if (row.predecessors !== undefined && row.predecessors !== null && String(row.predecessors).trim() !== '') {
                preds = String(row.predecessors)
                  .split(',')
                  .map(p => {
                    const trimmed = p.trim();
                    // Match ID followed by optional type (FS, SS, FF, SF)
                    const match = trimmed.match(/^(\d+)([A-Z]{2})?$/);
                    if (match) {
                      return {
                        id: Number(match[1]),
                        type: (match[2] as DependencyType) || 'FS'
                      };
                    }
                    return null;
                  })
                  .filter((p): p is Predecessor => p !== null && !isNaN(p.id) && p.id !== 0);
              }

              return {
                ...row,
                id: Number(row.id),
                progress: Number(row.progress) || 0,
                parentId: row.parentId ? Number(row.parentId) : undefined,
                predecessors: preds && preds.length > 0 ? preds : undefined,
                isMilestone: row.isMilestone === true || String(row.isMilestone).toUpperCase() === 'TRUE'
              } as Task;
            });
            
            setTasks(parsedTasks);
            setExpandedTaskIds(new Set(parsedTasks.map(t => t.id)));
          },
          error: (error) => {
            console.error("PapaParse error:", error);
          }
        });
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setTasks([]);
      });
  }, [selectedProjectId]);

   // === REFS & SYNC SCROLL (đã cải tiến - mượt mà hơn) ===
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);

  let isScrolling = false;   // flag chống loop

  const handleSidebarScroll = () => {
    if (isScrolling || !sidebarRef.current || !timelineRef.current) return;
    isScrolling = true;
    requestAnimationFrame(() => {
      timelineRef.current!.scrollTop = sidebarRef.current!.scrollTop;
      isScrolling = false;
    });
  };

  const handleTimelineScroll = () => {
    if (isScrolling || !sidebarRef.current || !timelineRef.current) return;
    isScrolling = true;
    requestAnimationFrame(() => {
      sidebarRef.current!.scrollTop = timelineRef.current!.scrollTop;
      if (timelineHeaderRef.current) {
        timelineHeaderRef.current.scrollLeft = timelineRef.current!.scrollLeft;
      }
      isScrolling = false;
    });
  };

  // Tự động sync lại khi danh sách task thay đổi (mở/rộng task)
  useEffect(() => {
    if (sidebarRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = sidebarRef.current.scrollTop;
    }
  }, [visibleTasks]);

  const scrollToTask = (taskId: number) => {
    const pos = taskPositions.get(taskId);
    if (pos && timelineRef.current) {
      // Scroll horizontally to task
      const containerWidth = timelineRef.current.clientWidth;
      const scrollLeft = pos.x - containerWidth / 2 + pos.width / 2;
      timelineRef.current.scrollTo({
        left: scrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const toggleExpand = (taskId: number) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Helper to get hierarchical tasks (full flat list in order)
  const sortedTasks = useMemo(() => {
    const result: Task[] = [];
    const map = new Map<number | undefined, Task[]>();
    
    tasks.forEach(task => {
      const parentId = task.parentId;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(task);
    });

    const traverse = (parentId: number | undefined) => {
      const children = map.get(parentId) || [];
      children.forEach(child => {
        result.push(child);
        traverse(child.id);
      });
    };

    traverse(undefined);
    return result;
  }, [tasks]);

  // Helper to get only visible tasks based on expansion state
  const visibleTasks = useMemo(() => {
    const result: Task[] = [];
    const map = new Map<number | undefined, Task[]>();
    
    tasks.forEach(task => {
      const parentId = task.parentId;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(task);
    });

    const traverse = (parentId: number | undefined) => {
      const children = map.get(parentId) || [];
      children.forEach(child => {
        result.push(child);
        if (expandedTaskIds.has(child.id)) {
          traverse(child.id);
        }
      });
    };

    traverse(undefined);
    return result;
  }, [tasks, expandedTaskIds]);

  const getTaskDepth = (taskId: number) => {
    let depth = 0;
    let current = tasks.find(t => t.id === taskId);
    while (current?.parentId) {
      depth++;
      current = tasks.find(t => t.id === current?.parentId);
    }
    return depth;
  };

  const stats = useMemo(() => {
    const completed = tasks.filter(t => t.progress === 100).length;
    const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
    const notStarted = tasks.filter(t => t.progress === 0).length;
    const avgProgress = tasks.length > 0 ? Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length) : 0;
    return { completed, inProgress, notStarted, avgProgress };
  }, [tasks]);

  const getISOWeek = (date: Date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const ganttData = useMemo(() => {
    if (tasks.length === 0) return { periods: [], minDate: new Date(), maxDate: new Date() };

    const minDate = new Date(Math.min(...tasks.map(t => new Date(t.startDate).getTime())));
    const maxDate = new Date(Math.max(...tasks.map(t => new Date(t.endDate).getTime())));
    
    // Normalize to midnight
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);
    
    // Adjust min/max for padding
    minDate.setDate(1);
    maxDate.setMonth(maxDate.getMonth() + 1);
    maxDate.setDate(0);

    const periods: { 
      label: string; 
      date: Date; 
      isCurrent: boolean; 
      isWeekend?: boolean; 
      isLastOfGroup: boolean;
    }[] = [];
    const current = new Date(minDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (ganttMode === 'month') {
      while (current <= maxDate) {
        const isCurrent = today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear();
        const isLastOfGroup = current.getMonth() === 11; // Last month of year
        periods.push({
          label: `${current.getMonth() + 1}/${current.getFullYear()}`,
          date: new Date(current),
          isCurrent,
          isLastOfGroup
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (ganttMode === 'week') {
      while (current <= maxDate) {
        const weekNum = getISOWeek(current);
        const currentWeekNum = getISOWeek(today);
        const isCurrent = weekNum === currentWeekNum && today.getFullYear() === current.getFullYear();
        
        // Check if next week is in a different month
        const nextWeek = new Date(current);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const isLastOfGroup = nextWeek.getMonth() !== current.getMonth();

        periods.push({
          label: `${weekNum}`,
          date: new Date(current),
          isCurrent,
          isLastOfGroup
        });
        current.setDate(current.getDate() + 7);
      }
    } else {
      while (current <= maxDate) {
        const isCurrent = today.getTime() === current.getTime();
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;
        
        // Check if next day is in a different month
        const nextDay = new Date(current);
        nextDay.setDate(nextDay.getDate() + 1);
        const isLastOfGroup = nextDay.getMonth() !== current.getMonth();

        periods.push({
          label: `${current.getDate()}`,
          date: new Date(current),
          isCurrent,
          isWeekend,
          isLastOfGroup
        });
        current.setDate(current.getDate() + 1);
      }
    }

    return { periods, minDate, maxDate };
  }, [tasks, ganttMode]);

  const COLUMN_WIDTH = ganttMode === 'month' ? 100 : 40;

  const ganttHeaderGroups = useMemo(() => {
    const { periods } = ganttData;
    if (periods.length === 0) return [];

    const groups: { label: string; count: number }[] = [];
    let currentGroup = { label: '', count: 0 };

    periods.forEach((p) => {
      const label = ganttMode === 'month' ? `Năm ${p.date.getFullYear()}` : `Tháng ${p.date.getMonth() + 1}/${p.date.getFullYear()}`;

      if (label !== currentGroup.label) {
        if (currentGroup.count > 0) groups.push({ ...currentGroup });
        currentGroup = { label, count: 1 };
      } else {
        currentGroup.count++;
      }
    });
    groups.push(currentGroup);
    return groups;
  }, [ganttData, ganttMode]);

  const totalTimelineWidth = ganttData.periods.length * COLUMN_WIDTH;

  const taskPositions = useMemo(() => {
    const positions = new Map<number, { x: number; y: number; width: number }>();
    const totalDuration = ganttData.maxDate.getTime() - ganttData.minDate.getTime();
    
    visibleTasks.forEach((task, index) => {
      const taskStart = new Date(task.startDate).getTime();
      const taskEnd = new Date(task.endDate).getTime();
      const left = ((taskStart - ganttData.minDate.getTime()) / totalDuration) * totalTimelineWidth;
      const width = Math.max(((taskEnd - taskStart) / totalDuration) * totalTimelineWidth, 20);
      
      // y position is based on index in visibleTasks (each row is 48px)
      positions.set(task.id, { x: left, y: index * 48 + 24, width });
    });
    return positions;
  }, [visibleTasks, ganttData, totalTimelineWidth]);

  const dependencyArrows = useMemo(() => {
    const arrows: React.ReactNode[] = [];
    visibleTasks.forEach((task) => {
      const isParent = tasks.some(t => t.parentId === task.id);
      if (isParent) return;

      if (task.predecessors) {
        task.predecessors.forEach((pre) => {
          const fromPos = taskPositions.get(pre.id);
          const toPos = taskPositions.get(task.id);
          
          if (fromPos && toPos) {
            let fromX, toX;
            let strokeColor = '#475569';

            switch (pre.type) {
              case 'SS':
                fromX = fromPos.x;
                toX = toPos.x;
                strokeColor = '#3b82f6'; // Blue
                break;
              case 'FF':
                fromX = fromPos.x + fromPos.width;
                toX = toPos.x + toPos.width;
                strokeColor = '#10b981'; // Emerald
                break;
              case 'SF':
                fromX = fromPos.x;
                toX = toPos.x + toPos.width;
                strokeColor = '#f59e0b'; // Amber
                break;
              case 'FS':
              default:
                fromX = fromPos.x + fromPos.width;
                toX = toPos.x;
                strokeColor = '#6366f1'; // Indigo
                break;
            }

            const fromY = fromPos.y; 
            const toY = toPos.y;

            // travelY is the midpoint between rows
            const travelY = fromY + 24; 
            
            // Stepped path to avoid overlapping labels
            // Labels are at the end of the bar (fromX + 12px)
            // We go down first, then horizontal, then to the target
            const path = `M ${fromX} ${fromY} 
                          L ${fromX} ${travelY} 
                          L ${toX - 12} ${travelY} 
                          L ${toX - 12} ${toY} 
                          L ${toX} ${toY}`;
            
            arrows.push(
              <path
                key={`${pre.id}-${task.id}-${pre.type}`}
                d={path}
                fill="none"
                stroke={strokeColor}
                color={strokeColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerStart="url(#dot)"
                markerEnd="url(#dot)"
                className="transition-all duration-300 opacity-70 hover:opacity-100 hover:stroke-width-[4]"
              />
            );
          }
        });
      }
    });
    return arrows;
  }, [visibleTasks, taskPositions, tasks]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const getStatusColor = (progress: number) => {
    if (progress === 100) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (progress > 0) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusText = (progress: number) => {
    if (progress === 100) return 'Hoàn thành';
    if (progress > 0) return 'Đang thực hiện';
    return 'Chưa bắt đầu';
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Project Sidebar */}
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={`project-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-900">
            <Layout className="w-6 h-6 text-indigo-600" />
            Bảng Tiến Độ
          </h1>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow py-4 overflow-y-auto">
          <div className="px-6 mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dự án</span>
          </div>
          {PROJECTS.map(project => (
            <div 
              key={project.id}
              className={`project-item ${selectedProjectId === project.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedProjectId(project.id);
                if (window.innerWidth < 1024) setIsSidebarOpen(false);
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedProjectId === project.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="font-bold">{project.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="bg-indigo-600 p-2 rounded-lg hidden sm:block">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {PROJECTS.find(p => p.id === selectedProjectId)?.name}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Hệ thống quản lý tiến độ dự án chuyên nghiệp</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab(0)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 0 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tổng quan
              </button>
              <button 
                onClick={() => setActiveTab(1)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 1 ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Bảng Tiến Độ
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow overflow-auto p-4 sm:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 0 ? (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Hoàn thành', value: stats.completed, color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50' },
                  { label: 'Đang thực hiện', value: stats.inProgress, color: 'text-blue-600', icon: Clock, bg: 'bg-blue-50' },
                  { label: 'Chưa bắt đầu', value: stats.notStarted, color: 'text-amber-600', icon: AlertCircle, bg: 'bg-amber-50' },
                  { label: 'Trung bình', value: `${stats.avgProgress}%`, color: 'text-indigo-600', icon: BarChart3, bg: 'bg-indigo-50' },
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center ${item.color}`}>
                      <item.icon size={24} />
                    </div>
                    <div>
                      <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                      <div className="text-sm font-medium text-slate-500">{item.label}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Task Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-800">Danh sách nhiệm vụ</h2>
                  <span className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                    {tasks.length} Nhiệm vụ
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-8 py-4">Nhiệm vụ</th>
                        <th className="px-6 py-4">Thời gian</th>
                        <th className="px-6 py-4 text-center">Số ngày</th>
                        <th className="px-6 py-4">Người phụ trách</th>
                        <th className="px-8 py-4 text-center">Tiến độ</th>
                        <th className="px-6 py-4 text-center">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleTasks.map((task) => {
                        const isParent = tasks.some(t => t.parentId === task.id);
                        const isExpanded = expandedTaskIds.has(task.id);
                        const depth = getTaskDepth(task.id);
                        
                        return (
                          <tr 
                            key={task.id} 
                            className={`group hover:bg-slate-50/50 transition-colors ${isParent ? 'bg-indigo-50/50' : ''}`}
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
                                {isParent ? (
                                  <button 
                                    onClick={() => toggleExpand(task.id)}
                                    className="p-1 hover:bg-white rounded-md transition-colors text-slate-400"
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : (
                                  <div className="w-6" />
                                )}
                                <div>
                                  <div className={`font-bold text-slate-800 group-hover:text-indigo-600 transition-colors ${depth === 0 ? 'text-base' : 'text-sm'} ${isParent ? 'text-indigo-900 font-black' : ''} flex items-center gap-2`}>
                                    {task.taskName}
                                    {task.isMilestone && (
                                      <span className="w-2 h-2 bg-amber-500 rotate-45 inline-block" title="Mốc quan trọng" />
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    ID: #{task.id} {task.predecessors && `• Pre: ${task.predecessors.join(', ')}`}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                            <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                              {formatDate(task.startDate)} <ChevronRight size={12} className="text-slate-300" /> {formatDate(task.endDate)}
                            </div>
                          </td>
                            <td className="px-6 py-5 text-center">
                              <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                                {task.duration || Math.ceil((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24))}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                  <User size={14} />
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{task.assignee}</span>
                              </div>
                            </td>
                          <td className="px-8 py-5">
                            <div className="w-32 mx-auto">
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${task.progress}%` }}
                                  className="h-full bg-indigo-500 rounded-full"
                                />
                              </div>
                              <div className="text-[10px] font-bold text-center mt-1.5 text-slate-500">{task.progress}%</div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                              title="Xem chi tiết"
                            >
                              <Info size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="gantt"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
                <h2 className="text-xl font-bold text-slate-800">Biểu đồ Gantt</h2>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {(['day', 'week', 'month'] as GanttMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setGanttMode(mode)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${ganttMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="instagantt-wrapper shadow-xl">
                {/* Left Sidebar: Task List */}
                <div className="task-sidebar">
                  <div className="h-[73px] bg-slate-50 border-b border-slate-200 flex items-end p-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tên nhiệm vụ</span>
                  </div>
                  <div 
                    ref={sidebarRef}
                    onScroll={handleSidebarScroll}
                    className="overflow-y-auto flex-grow no-scrollbar"
                  >
                    {visibleTasks.map((task) => {
                      const isParent = tasks.some(t => t.parentId === task.id);
                      const isExpanded = expandedTaskIds.has(task.id);
                      const depth = getTaskDepth(task.id);
                      
                      return (
                        <div 
                          key={task.id} 
                          className={`gantt-row cursor-pointer transition-colors ${isParent ? 'bg-indigo-50/40' : ''}`}
                          onClick={() => {
                            setSelectedTask(task);
                            scrollToTask(task.id);
                          }}
                        >
                          <div className="sidebar-task-item" style={{ paddingLeft: depth * 20 + 16 }}>
                            {isParent ? (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(task.id);
                                }}
                                className="p-1 hover:bg-white rounded-md transition-colors text-slate-400 flex-shrink-0"
                              >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </button>
                            ) : (
                              <div className="w-5 flex-shrink-0" />
                            )}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.progress === 100 ? 'bg-emerald-500' : task.progress > 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                            <span className={`truncate ${depth === 0 ? 'font-black text-slate-800' : 'text-slate-600 text-sm'} ${isParent ? 'text-indigo-900' : ''}`}>{task.taskName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Timeline */}
                <div className="timeline-view">
                  {/* Timeline Header */}
                  <div 
                    ref={timelineHeaderRef}
                    className="timeline-header-container overflow-hidden" 
                    style={{ width: '100%' }}
                  >
                    <div style={{ width: ganttData.periods.length * COLUMN_WIDTH }}>
                      {/* Top Row: Month/Year */}
                      <div className="header-row-top">
                        {ganttHeaderGroups.map((group, i) => (
                          <div 
                            key={i} 
                            className="header-cell header-cell-top" 
                            style={{ width: group.count * COLUMN_WIDTH }}
                          >
                            {group.label}
                          </div>
                        ))}
                      </div>
                      {/* Bottom Row: Day/Week */}
                      <div className="header-row-bottom">
                        {ganttData.periods.map((p, i) => (
                          <div 
                            key={i} 
                            className={`header-cell ${p.isCurrent ? 'is-current' : ''} ${p.isLastOfGroup ? 'border-separator' : ''}`} 
                            style={{ width: COLUMN_WIDTH }}
                          >
                            {p.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Timeline Content */}
                  <div 
                    ref={timelineRef}
                    onScroll={handleTimelineScroll}
                    className="relative flex-grow overflow-auto" 
                    style={{ width: '100%' }}
                  >
                    <div style={{ width: ganttData.periods.length * COLUMN_WIDTH, position: 'relative', minHeight: '100%' }}>
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex">
                        {ganttData.periods.map((p, i) => (
                          <div 
                            key={i} 
                            className={`timeline-column ${p.isWeekend ? 'bg-weekend' : ''} ${p.isCurrent ? 'bg-current-period' : ''} ${p.isLastOfGroup ? 'border-separator' : ''}`} 
                            style={{ width: COLUMN_WIDTH }} 
                          />
                        ))}
                      </div>

                    {/* Row Backgrounds for Parent Tasks */}
                    <div className="absolute inset-0 pointer-events-none">
                      {visibleTasks.map((task, i) => {
                        const isParent = tasks.some(t => t.parentId === task.id);
                        if (!isParent) return null;
                        return (
                          <div 
                            key={`bg-${task.id}`} 
                            className="absolute left-0 right-0 bg-indigo-50/30 border-y border-indigo-100/50"
                            style={{ top: i * 48, height: 48 }}
                          />
                        );
                      })}
                    </div>

                    {/* Dependency Arrows SVG */}
                    <svg 
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: totalTimelineWidth, height: visibleTasks.length * 48, zIndex: 40 }}
                    >
                      <defs>
                        <marker id="dot" markerWidth="6" markerHeight="6" refX="3" refY="3" markerUnits="strokeWidth">
                          <circle cx="3" cy="3" r="2" fill="currentColor" />
                        </marker>
                      </defs>
                      {dependencyArrows}
                    </svg>

                    {/* Task Milestone Lines */}
                    {visibleTasks.filter(t => t.isMilestone).map(task => {
                      const pos = taskPositions.get(task.id);
                      if (!pos) return null;
                      return (
                        <div 
                          key={`milestone-line-${task.id}`} 
                          className="milestone-line" 
                          style={{ left: `${pos.x}px` }} 
                        />
                      );
                    })}

                    {/* Today Line is now handled by bg-current-period in the grid */}

                      {/* Task Bars */}
                    {visibleTasks.map((task) => {
                      const pos = taskPositions.get(task.id);
                      const isParent = tasks.some(t => t.parentId === task.id);

                      // Milestones rendering
                      if (task.isMilestone) {
                        return (
                          <div key={task.id} className="gantt-row">
                            <motion.div 
                              layoutId={`task-bar-${task.id}`}
                              onClick={() => setSelectedTask(task)}
                              className="milestone-diamond-large"
                              style={{ left: `${pos?.x}px` }}
                              whileHover={{ scale: 1.2, backgroundColor: '#fbbf24' }}
                              title={`${task.taskName} (${formatDate(task.startDate)})`}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={task.id} className="gantt-row">
                          <motion.div 
                            layoutId={`task-bar-${task.id}`}
                            onClick={() => setSelectedTask(task)}
                            className={`insta-bar ${isParent ? 'parent-bar' : ''}`}
                            style={{ left: `${pos?.x}px`, width: `${pos?.width}px` }}
                          >
                            {isParent && (
                              <>
                                <div 
                                  className="parent-bar-triangle left" 
                                  style={{ borderTopColor: task.progress > 0 ? '#4f46e5' : '#e0e7ff' }} 
                                />
                                <div 
                                  className="parent-bar-triangle right" 
                                  style={{ borderTopColor: task.progress === 100 ? '#4f46e5' : '#e0e7ff' }} 
                                />
                              </>
                            )}
                            <div 
                              className={`insta-progress ${task.progress === 100 ? 'full' : ''}`}
                              style={{ width: `${task.progress}%` }}
                            />
                            <div className="insta-bar-label">
                              <span>{task.progress}%</span>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{selectedTask.taskName}</h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Nhiệm vụ #{selectedTask.id}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Người phụ trách</p>
                    <p className="font-bold text-slate-700 flex items-center gap-2">
                      <User size={16} className="text-indigo-500" /> {selectedTask.assignee}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái</p>
                    <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(selectedTask.progress)}`}>
                      {getStatusText(selectedTask.progress)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Bắt đầu</p>
                    <p className="font-bold text-slate-700">{formatDate(selectedTask.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Kết thúc</p>
                    <p className="font-bold text-slate-700">{formatDate(selectedTask.endDate)}</p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nguồn</p>
                    <p className="text-sm font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {selectedTask.source || 'Không có thông tin nguồn'}
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú</p>
                    <p className="text-sm text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 italic">
                      "{selectedTask.notes || 'Chưa có ghi chú cho nhiệm vụ này.'}"
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Tiến độ thực hiện</p>
                    <p className="text-2xl font-black text-indigo-600">{selectedTask.progress}%</p>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedTask.progress}%` }}
                      className="h-full bg-indigo-500 rounded-full shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
