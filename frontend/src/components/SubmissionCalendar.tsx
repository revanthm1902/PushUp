import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Trophy, Target } from 'lucide-react';

interface DailySubmissionData {
  date: string;
  submissions: number;
  problems: {
    easy: number;
    medium: number;
    hard: number;
  };
}

interface CalendarDayData extends DailySubmissionData {
  isCurrentMonth: boolean;
  isToday: boolean;
  dayNumber: number;
}

interface SubmissionCalendarProps {
  dailySubmissions: DailySubmissionData[];
}

export default function SubmissionCalendar({ dailySubmissions }: SubmissionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDay, setHoveredDay] = useState<DailySubmissionData | null>(null);

  // Calculate stats for current month
  const currentMonthStats = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthlySubmissions = dailySubmissions.filter(day => {
      const date = new Date(day.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    
    const totalSubmissions = monthlySubmissions.reduce((sum, day) => sum + day.submissions, 0);
    const activeDays = monthlySubmissions.filter(day => day.submissions > 0).length;
    const maxStreak = calculateMaxStreak(monthlySubmissions);
    
    return { totalSubmissions, activeDays, maxStreak };
  };

  const calculateMaxStreak = (monthData: DailySubmissionData[]) => {
    let maxStreak = 0;
    let currentStreak = 0;
    
    // Sort by date and check consecutive days
    const sortedData = monthData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    for (let i = 0; i < sortedData.length; i++) {
      if (sortedData[i].submissions > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    return maxStreak;
  };

  // Generate calendar data for the current month
  const generateMonthData = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get first day of the month
    const firstDay = new Date(year, month, 1);
    
    // Get the first day of the calendar (might be from previous month)
    const calendarStart = new Date(firstDay);
    calendarStart.setDate(firstDay.getDate() - firstDay.getDay());
    
    // Generate 6 weeks of calendar data (42 days)
    const weeks: CalendarDayData[][] = [];
    let currentWeek: CalendarDayData[] = [];
    
    for (let i = 0; i < 42; i++) {
      const currentDay = new Date(calendarStart);
      currentDay.setDate(calendarStart.getDate() + i);
      
      const dateString = currentDay.toISOString().split('T')[0];
      const submissionData = dailySubmissions.find(d => d.date === dateString);
      
      const dayData: DailySubmissionData = submissionData || {
        date: dateString,
        submissions: 0,
        problems: { easy: 0, medium: 0, hard: 0 }
      };
      
      // Add metadata for rendering
      const dayWithMeta: CalendarDayData = {
        ...dayData,
        isCurrentMonth: currentDay.getMonth() === month,
        isToday: dateString === new Date().toISOString().split('T')[0],
        dayNumber: currentDay.getDate()
      };
      
      currentWeek.push(dayWithMeta);
      
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }
    
    return weeks;
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Format date for tooltip
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const weeks = generateMonthData(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
      {/* Header with Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Activity Calendar</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-green-400">
            <Trophy className="w-3 h-3" />
            <span>{currentMonthStats().activeDays} days</span>
          </div>
          <div className="flex items-center gap-1 text-blue-400">
            <Target className="w-3 h-3" />
            <span>{currentMonthStats().totalSubmissions} total</span>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white" />
        </button>
        
        <h3 className="text-lg font-medium text-white">
          {monthYear}
        </h3>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors group"
        >
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="relative">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 p-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day: CalendarDayData, dayIndex) => {
                const intensity = Math.min(day.submissions, 4);
                const intensityClasses = [
                  'bg-gray-700/30', // 0 submissions
                  'bg-green-900/60', // 1 submission
                  'bg-green-700/70', // 2 submissions
                  'bg-green-500/80', // 3 submissions
                  'bg-green-400/90', // 4+ submissions
                ];
                
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`
                      relative aspect-square rounded-lg border transition-all duration-200 cursor-pointer
                      ${day.isCurrentMonth ? 'border-gray-600/50' : 'border-gray-700/30'}
                      ${day.isToday ? 'ring-2 ring-blue-400 ring-opacity-60' : ''}
                      ${intensityClasses[intensity]}
                      hover:scale-105 hover:border-gray-500 hover:shadow-lg
                      group
                    `}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                  >
                    <div className="flex items-center justify-center h-full">
                      <span className={`
                        text-xs font-medium transition-colors
                        ${day.isCurrentMonth ? 'text-white' : 'text-gray-500'}
                        ${day.isToday ? 'text-blue-100 font-bold' : ''}
                        group-hover:text-white
                      `}>
                        {day.dayNumber}
                      </span>
                    </div>
                    
                    {/* Difficulty indicators */}
                    {day.submissions > 0 && (
                      <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {day.problems.easy > 0 && (
                          <div className="w-1 h-1 rounded-full bg-green-400"></div>
                        )}
                        {day.problems.medium > 0 && (
                          <div className="w-1 h-1 rounded-full bg-yellow-400"></div>
                        )}
                        {day.problems.hard > 0 && (
                          <div className="w-1 h-1 rounded-full bg-red-400"></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        
        {/* Enhanced Tooltip */}
        {hoveredDay && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm rounded-xl shadow-xl z-20 border border-gray-700/50 min-w-48">
            <div className="font-semibold text-blue-300 mb-1">{formatDate(hoveredDay.date)}</div>
            <div className="text-green-400 font-medium mb-2">
              {hoveredDay.submissions} submission{hoveredDay.submissions !== 1 ? 's' : ''}
            </div>
            {hoveredDay.submissions > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-gray-300">Easy</span>
                  </div>
                  <span className="font-medium text-green-400">{hoveredDay.problems.easy}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <span className="text-gray-300">Medium</span>
                  </div>
                  <span className="font-medium text-yellow-400">{hoveredDay.problems.medium}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <span className="text-gray-300">Hard</span>
                  </div>
                  <span className="font-medium text-red-400">{hoveredDay.problems.hard}</span>
                </div>
              </div>
            )}
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
          </div>
        )}
      </div>
      
      {/* Enhanced Legend */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700/50">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-700/30 border border-gray-600/50"></div>
            <div className="w-3 h-3 rounded bg-green-900/60 border border-gray-600/50"></div>
            <div className="w-3 h-3 rounded bg-green-700/70 border border-gray-600/50"></div>
            <div className="w-3 h-3 rounded bg-green-500/80 border border-gray-600/50"></div>
            <div className="w-3 h-3 rounded bg-green-400/90 border border-gray-600/50"></div>
          </div>
          <span>More</span>
        </div>
        
        <div className="text-xs text-gray-400">
          Max streak: <span className="text-orange-400 font-medium">{currentMonthStats().maxStreak} days</span>
        </div>
      </div>
    </div>
  );
}