import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

  // Get intensity color based on submission count
  const getIntensityColor = (submissions: number, isCurrentMonth: boolean): string => {
    if (!isCurrentMonth) {
      return 'bg-gray-100 dark:bg-gray-700 text-gray-400';
    }
    
    if (submissions === 0) return 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400';
    if (submissions === 1) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (submissions === 2) return 'bg-green-300 dark:bg-green-700 text-green-900 dark:text-green-100';
    if (submissions <= 4) return 'bg-green-400 dark:bg-green-600 text-white';
    return 'bg-green-500 dark:bg-green-500 text-white';
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

  // Go to current month
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const weeks = generateMonthData(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const totalSubmissions = dailySubmissions.reduce((sum, day) => sum + day.submissions, 0);
  
  // Get current month's submissions
  const currentMonthSubmissions = weeks.flat()
    .filter((day: CalendarDayData) => day.isCurrentMonth)
    .reduce((sum, day) => sum + day.submissions, 0);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Submission Calendar
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentMonthSubmissions} submissions this month • {totalSubmissions} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            {monthYear}
          </button>
          
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="relative">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar weeks */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day: CalendarDayData, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`
                    relative w-8 h-8 rounded text-xs font-medium cursor-pointer transition-all duration-200 
                    flex items-center justify-center border
                    ${getIntensityColor(day.submissions, day.isCurrentMonth)}
                    ${day.isToday ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                    hover:scale-110 hover:z-10 hover:shadow-lg
                    ${!day.isCurrentMonth ? 'opacity-40' : ''}
                  `}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  title={`${formatDate(day.date)}: ${day.submissions} submissions`}
                >
                  {day.dayNumber}
                  {day.submissions > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full text-[8px] text-white flex items-center justify-center">
                      {day.submissions > 9 ? '9+' : day.submissions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {/* Tooltip */}
        {hoveredDay && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-20 whitespace-nowrap">
            <div className="font-semibold">{formatDate(hoveredDay.date)}</div>
            <div className="text-blue-300">{hoveredDay.submissions} submissions</div>
            {hoveredDay.submissions > 0 && (
              <div className="text-xs text-gray-300 mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-green-300">Easy:</span>
                  <span>{hoveredDay.problems.easy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-300">Medium:</span>
                  <span>{hoveredDay.problems.medium}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-300">Hard:</span>
                  <span>{hoveredDay.problems.hard}</span>
                </div>
              </div>
            )}
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-xs text-gray-600 dark:text-gray-400">
        <span>Less</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-600"></div>
          <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-800"></div>
          <div className="w-3 h-3 rounded bg-green-300 dark:bg-green-700"></div>
          <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-600"></div>
          <div className="w-3 h-3 rounded bg-green-500 dark:bg-green-500"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}