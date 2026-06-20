import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, LogOut, Calendar, ChevronLeft, ChevronRight, Download, PencilLine, Trash2, Save, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  amount_text?: string | null;
  category: string;
  note?: string;
  date: string;
}

interface TransactionFormState {
  type: 'income' | 'expense';
  amount: string;
  category: string;
  note: string;
  date: string;
}

const Dashboard: React.FC = () => {
  const initialTimeZone = typeof window !== 'undefined' ? localStorage.getItem('timezone') || 'Asia/Bangkok' : 'Asia/Bangkok';

  const resolveTZ = (tz: string) => tz === 'Browser' ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz;

  const getNowInTZ = (tz: string) => {
    const resolved = resolveTZ(tz);
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: resolved,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
    return new Date(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState<Date>(() => getNowInTZ(initialTimeZone));
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(() => format(getNowInTZ(initialTimeZone), 'yyyy-MM-dd'));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectorZoomMode, setSelectorZoomMode] = useState<'day' | 'month' | 'year' | 'decade'>('day');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionFormState>({
    type: 'expense',
    amount: '',
    category: '',
    note: '',
    date: '',
  });
  const navigate = useNavigate();
  const timezoneOptions = [
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ไทย)' },
    { value: 'UTC', label: 'UTC' },
    { value: 'Browser', label: 'Browser Local' },
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  ];

  const [timeZone, setTimeZone] = useState<string>(() => localStorage.getItem('timezone') || 'Asia/Bangkok');
  const [isTZMenuOpen, setIsTZMenuOpen] = useState(false);
  const timeZoneMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('timezone', timeZone);
  }, [timeZone]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeZoneMenuRef.current && !timeZoneMenuRef.current.contains(event.target as Node)) {
        setIsTZMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Convert an instant (ISO or Date) into a Date object whose fields
  // represent the wall-clock time in `timeZone`. We use Intl.formatToParts
  // to get the timezone-local components and construct a Date from them
  // so `date-fns` formatting (which uses the runtime's locale) shows
  // the intended timezone values.
  const toZonedDate = (d?: string | Date) => {
    try {
      const tz = resolveTZ(timeZone);
      const date = d ? new Date(d) : new Date();
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
      const year = Number(parts.year || date.getFullYear());
      const month = Number(parts.month || (date.getMonth() + 1));
      const day = Number(parts.day || date.getDate());
      const hour = Number(parts.hour || date.getHours());
      const minute = Number(parts.minute || date.getMinutes());
      const second = Number(parts.second || date.getSeconds());
      // Construct a Date in the runtime's local zone with the timezone-local fields
      return new Date(year, month - 1, day, hour, minute, second);
    } catch (e) {
      return new Date(d ? new Date(d) : new Date());
    }
  };

  const formatAmountDisplay = (transaction: Transaction) => {
    return transaction.amount_text?.trim() || transaction.amount.toLocaleString();
  };

  const formatAmountTotal = (transaction: Transaction) => {
    return transaction.amount.toLocaleString();
  };

  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectorZoomMode(viewMode);
  }, [viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const transRes = await api.get('/transactions/');
      setTransactions(transRes.data);
    } catch (err) {
      console.error(err);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setEditForm({
      type: transaction.type,
      amount: transaction.amount_text?.trim() || transaction.amount.toString(),
      category: transaction.category,
      note: transaction.note ?? '',
      date: format(toZonedDate(transaction.date), "yyyy-MM-dd'T'HH:mm"),
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTransactionId(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransactionId || !editForm.amount || !editForm.category || !editForm.date) return;

    try {
      // interpret editForm.date (e.g. "YYYY-MM-DDTHH:mm") as wall-clock in the selected timezone
      const tz = resolveTZ(timeZone);
      const [datePart, timePart] = editForm.date.split('T');
      const [y, m, dStr] = datePart.split('-').map(Number);
      const [hh, mm] = (timePart || '').split(':').map(Number);

      // Create a millisecond value as if those fields were UTC, then
      // compute the zone offset at that moment and adjust to get the true UTC instant.
      const asIfUtc = Date.UTC(y, m - 1, dStr, hh || 0, mm || 0, 0);

      const getZoneOffsetMinutes = (timeZoneName: string, referenceDateMs: number) => {
        const ref = new Date(referenceDateMs);
        const fmt = new Intl.DateTimeFormat('en-US', {
          timeZone: timeZoneName,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        const parts = Object.fromEntries(fmt.formatToParts(ref).map(p => [p.type, p.value]));
        const yy = Number(parts.year);
        const mmn = Number(parts.month);
        const dd = Number(parts.day);
        const hh2 = Number(parts.hour);
        const min2 = Number(parts.minute);
        const sec2 = Number(parts.second);
        const asLocalUtc = Date.UTC(yy, mmn - 1, dd, hh2, min2, sec2);
        return (asLocalUtc - ref.getTime()) / 60000; // minutes
      };

      const offsetMinutes = getZoneOffsetMinutes(tz, asIfUtc);
      const actualUtcMs = asIfUtc - offsetMinutes * 60 * 1000;
      const utcDate = new Date(actualUtcMs).toISOString();

      await api.put(`/transactions/${editingTransactionId}`, {
        type: editForm.type,
        amount: editForm.amount,
        amount_text: editForm.amount,
        category: editForm.category,
        note: editForm.note,
        date: utcDate,
      });
      closeEditModal();
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    const confirmed = window.confirm(`ต้องการลบรายการ "${transaction.category}" ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      await api.delete(`/transactions/${transaction.id}`);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrev = () => {
    if (viewMode === 'day') {
      const newDate = subMonths(currentDate, 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setMonth(newDate.getMonth());
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (viewMode === 'month') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() - 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() - 10);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      const newDate = addMonths(currentDate, 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setMonth(newDate.getMonth());
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (viewMode === 'month') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + 10);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    }
  };

  const handleYearSelect = (year: number) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);

    const d = new Date(selectedDate);
    d.setFullYear(year);
    const maxDays = endOfMonth(newDate).getDate();
    d.setDate(Math.min(d.getDate(), maxDays));
    setSelectedDate(format(d, 'yyyy-MM-dd'));

    setIsDatePickerOpen(false);
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);

    const d = new Date(selectedDate);
    d.setMonth(monthIndex);
    d.setFullYear(newDate.getFullYear());
    const maxDays = endOfMonth(newDate).getDate();
    d.setDate(Math.min(d.getDate(), maxDays));
    setSelectedDate(format(d, 'yyyy-MM-dd'));

    setIsDatePickerOpen(false);
  };

  const startYear = Math.floor(currentDate.getFullYear() / 10) * 10;
  const years = Array.from({ length: 10 }, (_, i) => startYear + i);

  const getSelectorTitle = () => {
    if (selectorZoomMode === 'day') {
      return format(currentDate, 'MMMM yyyy', { locale: th });
    }
    if (selectorZoomMode === 'month') {
      return `${currentDate.getFullYear() + 543}`;
    }
    if (selectorZoomMode === 'year') {
      const startYearVal = Math.floor(currentDate.getFullYear() / 10) * 10;
      return `${startYearVal + 543} - ${startYearVal + 543 + 9}`;
    }
    if (selectorZoomMode === 'decade') {
      const startCentury = Math.floor(currentDate.getFullYear() / 100) * 100;
      return `${startCentury + 543} - ${startCentury + 543 + 99}`;
    }
    return '';
  };

  const handleSelectorZoomOut = () => {
    if (selectorZoomMode === 'day') {
      setSelectorZoomMode('month');
    } else if (selectorZoomMode === 'month') {
      setSelectorZoomMode('year');
    } else if (selectorZoomMode === 'year') {
      setSelectorZoomMode('decade');
    }
  };

  const handleSelectorPrev = () => {
    if (selectorZoomMode === 'day') {
      const newDate = subMonths(currentDate, 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setMonth(newDate.getMonth());
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'month') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() - 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'year') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() - 10);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'decade') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() - 100);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    }
  };

  const handleSelectorNext = () => {
    if (selectorZoomMode === 'day') {
      const newDate = addMonths(currentDate, 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setMonth(newDate.getMonth());
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'month') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + 1);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'year') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + 10);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    } else if (selectorZoomMode === 'decade') {
      const newDate = new Date(currentDate);
      newDate.setFullYear(currentDate.getFullYear() + 100);
      setCurrentDate(newDate);
      
      const d = new Date(selectedDate);
      d.setFullYear(newDate.getFullYear());
      const maxDays = endOfMonth(newDate).getDate();
      d.setDate(Math.min(d.getDate(), maxDays));
      setSelectedDate(format(d, 'yyyy-MM-dd'));
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut().finally(() => {
      localStorage.removeItem('token');
      navigate('/login');
    });
  };

  const handleDownloadCSV = (scope: 'all' | 'current') => {
    let data: Transaction[];
    let filename: string;

    if (scope === 'all') {
      data = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      filename = 'transactions_all.csv';
    } else {
      if (viewMode === 'day') {
        data = transactions.filter(t => format(toZonedDate(t.date), 'yyyy-MM-dd') === selectedDate);
        filename = `transactions_${selectedDate}.csv`;
      } else if (viewMode === 'month') {
        data = transactions.filter(t => {
          const d = toZonedDate(t.date);
          return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
        });
        filename = `transactions_${format(currentDate, 'yyyy-MM', { locale: th })}.csv`;
      } else {
        data = transactions.filter(t => toZonedDate(t.date).getFullYear() === currentDate.getFullYear());
        filename = `transactions_${currentDate.getFullYear()}.csv`;
      }
      data = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const header = ['วันที่', 'ประเภท', 'หมวดหมู่', 'จำนวนเงิน', 'หมายเหตุ'];
    const rows = data.map(t => [
      format(toZonedDate(t.date), 'dd/MM/yyyy HH:mm', { locale: th }),
      t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      t.category,
      formatAmountDisplay(t),
      t.note || ''
    ]);

    const csvContent = '\uFEFF' + [header, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloadModalOpen(false);
  };

  // Group transactions by date for day view
  const groupedTransactions = transactions.filter(t => 
    format(toZonedDate(t.date), 'yyyy-MM-dd') === selectedDate
  ).reduce((groups: any, transaction) => {
    const date = format(toZonedDate(transaction.date), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {});

  // For month view: group by date to show daily totals of the current month
  const monthlyDailyTotals = transactions.filter(t => {
    const d = toZonedDate(t.date);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  }).reduce((acc: any, t) => {
    const date = format(toZonedDate(t.date), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[date].income += t.amount;
    else acc[date].expense += t.amount;
    return acc;
  }, {});

  // For year view: group by month of the current year
  const yearlyMonthlyTotals = transactions.filter(t => 
    toZonedDate(t.date).getFullYear() === currentDate.getFullYear()
  ).reduce((acc: any, t) => {
    const month = toZonedDate(t.date).getMonth();
    if (!acc[month]) acc[month] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[month].income += t.amount;
    else acc[month].expense += t.amount;
    return acc;
  }, {});

  // Derived Summary
  const summary = (() => {
    let income = 0;
    let expense = 0;
    
    transactions.forEach(t => {
      const d = toZonedDate(t.date);
      if (viewMode === 'day') {
        // Daily summary: filter by selectedDate
        const dateStr = format(d, 'yyyy-MM-dd');
        if (dateStr === selectedDate) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
      } else if (viewMode === 'month') {
        // Monthly summary: filter by currentDate's month and year
        if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
      } else {
        // Yearly summary: filter by currentDate's year
        if (d.getFullYear() === currentDate.getFullYear()) {
          if (t.type === 'income') income += t.amount;
          else expense += t.amount;
        }
      }
    });
    
    return { income, expense, balance: income - expense };
  })();

  // Derived daily totals for Day selector grid
  const dailyTotals = transactions.reduce((acc: Record<string, { income: number; expense: number }>, t) => {
    const dateStr = format(toZonedDate(t.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[dateStr].income += t.amount;
    else acc[dateStr].expense += t.amount;
    return acc;
  }, {});

  // Derived monthly totals for Month selector grid
  const monthlyTotals = transactions.filter(t => 
    toZonedDate(t.date).getFullYear() === currentDate.getFullYear()
  ).reduce((acc: Record<number, { income: number; expense: number }>, t) => {
    const month = toZonedDate(t.date).getMonth();
    if (!acc[month]) acc[month] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[month].income += t.amount;
    else acc[month].expense += t.amount;
    return acc;
  }, {});

  // Derived yearly totals for Year selector grid
  const yearlyTotals = transactions.reduce((acc: Record<number, { income: number; expense: number }>, t) => {
    const year = toZonedDate(t.date).getFullYear();
    if (!acc[year]) acc[year] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[year].income += t.amount;
    else acc[year].expense += t.amount;
    return acc;
  }, {});

  // Get all days in the current month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header & Summary Card */}
      <div className="bg-gradient-to-b from-blue-700 to-blue-600 text-white pt-8 pb-20 px-6 rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>

        <div className="relative z-10">
          <div className="flex flex-row items-center justify-between gap-2 mb-8">
            <div className="flex items-center space-x-2 min-w-fit">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Wallet className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight whitespace-nowrap">Record Bil</h1>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative inline-block text-left" ref={timeZoneMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsTZMenuOpen((prev) => !prev)}
                  className="inline-flex items-center justify-between gap-1 max-w-[120px] bg-white text-gray-900 text-xs border border-slate-200 rounded-full px-2 py-0.5 shadow-sm hover:border-slate-300 transition-colors"
                  aria-haspopup="true"
                  aria-expanded={isTZMenuOpen}
                  title="เลือกโซนเวลา"
                >
                  <span className="truncate text-xs">{timezoneOptions.find(opt => opt.value === timeZone)?.label?.split(' ')[0] || timeZone}</span>
                  <span className="text-gray-400 text-xs">▾</span>
                </button>

                {isTZMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-[260px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    {timezoneOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTimeZone(opt.value);
                          setIsTZMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left text-sm transition-colors ${opt.value === timeZone ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsDownloadModalOpen(true)}
                  className="bg-white/10 p-1.5 hover:bg-white/20 rounded-lg transition-all active:scale-90 border border-white/10 backdrop-blur-sm"
                  title="ดาวน์โหลด CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsLogoutModalOpen(true)} 
                  className="bg-white/10 p-1.5 hover:bg-white/20 rounded-lg transition-all active:scale-90 border border-white/10 backdrop-blur-sm"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/20 shadow-inner">
            {/* View Mode & Date Navigation */}
            <div className="flex flex-col items-center mb-6 space-y-4">
              <div className="flex bg-black/20 p-1 rounded-2xl w-full max-w-xs border border-white/5">
                {(['day', 'month', 'year'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setViewMode(mode);
                      setSelectorZoomMode(mode);
                    }}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      viewMode === mode ? 'bg-white text-blue-600 shadow-lg' : 'text-blue-100 hover:text-white'
                    }`}
                  >
                    {mode === 'day' ? 'วัน' : mode === 'month' ? 'เดือน' : 'ปี'}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center justify-between w-full">
                <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex items-center space-x-2 relative">
                  <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="flex items-center space-x-2 hover:bg-white/10 p-2 rounded-xl transition-colors"
                  >
                    <Calendar className="w-5 h-5 text-blue-200" />
                    <span className="text-lg font-bold">
                      {viewMode === 'day' 
                        ? format(toZonedDate(selectedDate), 'dd MMMM yyyy', { locale: th })
                        : viewMode === 'month'
                        ? format(currentDate, 'MMMM yyyy', { locale: th })
                        : format(currentDate, 'yyyy', { locale: th })
                      }
                    </span>
                  </button>

                  {isDatePickerOpen && (
                    <div className="absolute top-full mt-2 bg-white text-gray-800 rounded-3xl shadow-2xl p-6 z-50 min-w-[280px] border border-gray-100 animate-in fade-in zoom-in duration-200">
                      {viewMode === 'year' ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b pb-3">
                            <span className="font-black text-gray-900">
                              {startYear + 543} - {startYear + 543 + 9}
                            </span>
                            <div className="flex space-x-1">
                              <button 
                                onClick={() => {
                                  const newDate = new Date(currentDate);
                                  newDate.setFullYear(currentDate.getFullYear() - 10);
                                  setCurrentDate(newDate);
                                }} 
                                className="p-1 hover:bg-gray-100 rounded-lg"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  const newDate = new Date(currentDate);
                                  newDate.setFullYear(currentDate.getFullYear() + 10);
                                  setCurrentDate(newDate);
                                }} 
                                className="p-1 hover:bg-gray-100 rounded-lg"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {years.map(y => (
                              <button
                                key={y}
                                onClick={() => handleYearSelect(y)}
                                className={`py-3 rounded-2xl font-bold transition-all text-sm ${
                                  currentDate.getFullYear() === y ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                {y + 543}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b pb-3">
                            <span className="font-black text-gray-900">{currentDate.getFullYear() + 543}</span>
                            <div className="flex space-x-1">
                              <button 
                                onClick={() => {
                                  const newDate = new Date(currentDate);
                                  newDate.setFullYear(currentDate.getFullYear() - 1);
                                  setCurrentDate(newDate);
                                }} 
                                className="p-1 hover:bg-gray-100 rounded-lg"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  const newDate = new Date(currentDate);
                                  newDate.setFullYear(currentDate.getFullYear() + 1);
                                  setCurrentDate(newDate);
                                }} 
                                className="p-1 hover:bg-gray-100 rounded-lg"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {months.map((m, i) => (
                              <button
                                key={m}
                                onClick={() => handleMonthSelect(i)}
                                className={`py-3 rounded-2xl font-bold transition-all text-sm ${
                                  currentDate.getMonth() === i ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            <p className="text-blue-100 text-sm mb-2 text-center font-semibold tracking-wide uppercase">
              ยอดคงเหลือ {viewMode === 'day' ? 'ประจำวัน' : viewMode === 'month' ? 'ประจำเดือน' : 'ประจำปี'}
            </p>
            <h2 className="text-5xl font-black text-center mb-8 tracking-tighter">
              <span className="text-2xl font-medium mr-1">฿</span>
              {summary.balance.toLocaleString()}
            </h2>
            <div className="flex justify-between items-center bg-black/10 rounded-3xl p-4 border border-white/5">
              <div className="flex flex-col items-center flex-1 border-r border-white/10">
                <p className="text-blue-200 text-[10px] mb-1 font-bold uppercase tracking-widest">รายรับ</p>
                <div className="flex items-center text-green-300 font-black text-lg">
                  <ArrowUpCircle className="w-4 h-4 mr-1.5" />
                  {summary.income.toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <p className="text-blue-200 text-[10px] mb-1 font-bold uppercase tracking-widest">รายจ่าย</p>
                <div className="flex items-center text-red-300 font-black text-lg">
                  <ArrowDownCircle className="w-4 h-4 mr-1.5" />
                  {summary.expense.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List Section */}
      <div className="px-6 -mt-10 relative z-20 space-y-8">
        {/* Main Grid Selector Card */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white animate-in fade-in slide-in-from-top-4 duration-500">
          {/* Card Navigation Header */}
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <button onClick={handleSelectorPrev} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <button 
              onClick={handleSelectorZoomOut}
              disabled={selectorZoomMode === 'decade'}
              className={`text-sm font-bold text-gray-700 px-4 py-1.5 rounded-xl transition-all ${
                selectorZoomMode !== 'decade' 
                  ? 'hover:text-blue-600 hover:bg-blue-50 cursor-pointer' 
                  : 'cursor-default'
              }`}
            >
              {getSelectorTitle()}
            </button>
            <button onClick={handleSelectorNext} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Grid Render based on selectorZoomMode */}
          {selectorZoomMode === 'day' && (
            <div className="grid grid-cols-7 gap-2">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {daysInMonth.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isSelected = selectedDate === dayStr;
                const totals = dailyTotals[dayStr] || { income: 0, expense: 0 };
                
                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDate(dayStr)}
                    className={`relative flex flex-col items-center justify-center aspect-square rounded-2xl transition-all duration-300 ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-lg z-10 scale-110' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="text-sm font-black">{format(day, 'd')}</span>
                    {(totals.income > 0 || totals.expense > 0) && (
                      <div className="flex flex-col items-center mt-0.5 leading-none space-y-[1px]">
                        {totals.income > 0 && (
                          <span className={`text-[7px] font-bold ${isSelected ? 'text-blue-100' : 'text-green-600'}`}>
                            {totals.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                        {totals.expense > 0 && (
                          <span className={`text-[7px] font-bold ${isSelected ? 'text-blue-100' : 'text-red-500'}`}>
                            {totals.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectorZoomMode === 'month' && (
            <div className="grid grid-cols-3 gap-3">
              {months.map((m, i) => {
                const isSelected = currentDate.getMonth() === i;
                const totals = monthlyTotals[i] || { income: 0, expense: 0 };
                return (
                  <button
                    key={m}
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setMonth(i);
                      setCurrentDate(newDate);

                      const d = new Date(selectedDate);
                      d.setMonth(i);
                      d.setFullYear(newDate.getFullYear());
                      const maxDays = endOfMonth(newDate).getDate();
                      d.setDate(Math.min(d.getDate(), maxDays));
                      setSelectedDate(format(d, 'yyyy-MM-dd'));

                      // Zoom back to 'day' if the parent viewMode is 'day'
                      if (viewMode === 'day') {
                        setSelectorZoomMode('day');
                      }
                    }}
                    className={`py-3.5 px-2 rounded-2xl font-black text-sm transition-all duration-300 flex flex-col items-center justify-center ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{m}</span>
                    {(totals.income > 0 || totals.expense > 0) && (
                      <div className="flex flex-col items-center mt-1 leading-none space-y-[2px]">
                        {totals.income > 0 && (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-green-600'}`}>
                            +{totals.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                        {totals.expense > 0 && (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-red-500'}`}>
                            -{totals.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectorZoomMode === 'year' && (
            <div className="grid grid-cols-3 gap-3">
              {years.map((y) => {
                const isSelected = currentDate.getFullYear() === y;
                const totals = yearlyTotals[y] || { income: 0, expense: 0 };
                return (
                  <button
                    key={y}
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setFullYear(y);
                      setCurrentDate(newDate);

                      const d = new Date(selectedDate);
                      d.setFullYear(y);
                      const maxDays = endOfMonth(newDate).getDate();
                      d.setDate(Math.min(d.getDate(), maxDays));
                      setSelectedDate(format(d, 'yyyy-MM-dd'));

                      // Zoom in to 'month' if the parent viewMode is 'day' or 'month'
                      if (viewMode === 'day' || viewMode === 'month') {
                        setSelectorZoomMode('month');
                      }
                    }}
                    className={`py-3.5 px-2 rounded-2xl font-black text-sm transition-all duration-300 flex flex-col items-center justify-center ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{y + 543}</span>
                    {(totals.income > 0 || totals.expense > 0) && (
                      <div className="flex flex-col items-center mt-1 leading-none space-y-[2px]">
                        {totals.income > 0 && (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-green-600'}`}>
                            +{totals.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                        {totals.expense > 0 && (
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-red-500'}`}>
                            -{totals.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectorZoomMode === 'decade' && (
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const startCentury = Math.floor(currentDate.getFullYear() / 100) * 100;
                const decades = Array.from({ length: 10 }, (_, i) => startCentury + i * 10);
                return decades.map((dec) => {
                  const isSelected = Math.floor(currentDate.getFullYear() / 10) * 10 === dec;
                  
                  // Calculate decade totals
                  let decIncome = 0;
                  let decExpense = 0;
                  transactions.forEach(t => {
                    const y = toZonedDate(t.date).getFullYear();
                    if (y >= dec && y <= dec + 9) {
                      if (t.type === 'income') decIncome += t.amount;
                      else decExpense += t.amount;
                    }
                  });

                  return (
                    <button
                      key={dec}
                      onClick={() => {
                        const newDate = new Date(currentDate);
                        newDate.setFullYear(dec);
                        setCurrentDate(newDate);

                        const d = new Date(selectedDate);
                        d.setFullYear(dec);
                        const maxDays = endOfMonth(newDate).getDate();
                        d.setDate(Math.min(d.getDate(), maxDays));
                        setSelectedDate(format(d, 'yyyy-MM-dd'));

                        setSelectorZoomMode('year');
                      }}
                      className={`py-3.5 px-1 rounded-2xl font-black text-xs transition-all duration-300 flex flex-col items-center justify-center ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-lg scale-105' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="text-[11px] leading-tight mb-1">
                        <div>{dec + 543} -</div>
                        <div>{dec + 543 + 9}</div>
                      </div>
                      {(decIncome > 0 || decExpense > 0) && (
                        <div className="flex flex-col items-center leading-none space-y-[2px]">
                          {decIncome > 0 && (
                            <span className={`text-[8px] font-bold ${isSelected ? 'text-blue-100' : 'text-green-600'}`}>
                              +{decIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          )}
                          {decExpense > 0 && (
                            <span className={`text-[8px] font-bold ${isSelected ? 'text-blue-100' : 'text-red-500'}`}>
                              -{decExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Day View Transactions */}
        {viewMode === 'day' && Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a)).map(date => (
          <div key={date} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4 ml-2">
              <h3 className="text-gray-900 font-black text-lg">
                {format(toZonedDate(date), 'dd MMMM yyyy', { locale: th })}
              </h3>
              <div className="bg-gray-200/50 h-[1px] flex-1 mx-4"></div>
            </div>
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] shadow-xl shadow-gray-200/50 overflow-hidden border border-white">
              {groupedTransactions[date].map((t: Transaction, index: number) => (
                <div 
                  key={t.id} 
                  className={`py-2 px-4 flex justify-between items-center gap-4 transition-colors hover:bg-gray-50/80 active:bg-gray-100/50 ${index !== 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-1.5 rounded-xl shadow-sm ${
                      t.type === 'income' 
                        ? 'bg-green-50 text-green-600 ring-1 ring-green-100' 
                        : 'bg-red-50 text-red-600 ring-1 ring-red-100'
                    }`}>
                      {t.type === 'income' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{t.category}</p>
                      {t.note && <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{t.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right max-w-[10rem] sm:max-w-[12rem]">
                      <p className={`font-black text-sm tracking-tight leading-tight whitespace-normal break-words ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="block">
                          {t.type === 'income' ? '+' : '-'}{formatAmountDisplay(t)}
                        </span>
                        <span className="block text-[10px] font-extrabold text-gray-400 mt-0.5">
                          รวม {formatAmountTotal(t)} THB
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        aria-label="Edit transaction"
                      >
                        <PencilLine className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(t)}
                        className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Month View Summary */}
        {viewMode === 'month' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-gray-900 font-black text-lg ml-2">สรุปรายวัน</h3>
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] shadow-xl shadow-gray-200/50 overflow-hidden border border-white">
              {Object.keys(monthlyDailyTotals).sort((a, b) => b.localeCompare(a)).map((date, index) => (
                <div 
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setViewMode('day');
                  }}
                  className={`py-2 px-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors ${index !== 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-xl flex flex-col items-center justify-center border border-blue-100">
                      <span className="text-[7px] font-bold text-blue-400 uppercase">{format(toZonedDate(date), 'EEE', { locale: th })}</span>
                      <span className="text-xs font-black text-blue-600 leading-none">{format(toZonedDate(date), 'd')}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{format(toZonedDate(date), 'd MMMM', { locale: th })}</p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">คลิกเพื่อดูรายละเอียด</p>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    {monthlyDailyTotals[date].income > 0 && (
                      <p className="text-green-600 font-black text-xs">+{monthlyDailyTotals[date].income.toLocaleString()}</p>
                    )}
                    {monthlyDailyTotals[date].expense > 0 && (
                      <p className="text-red-600 font-black text-xs">-{monthlyDailyTotals[date].expense.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Year View Summary */}
        {viewMode === 'year' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-gray-900 font-black text-lg ml-2">สรุปรายเดือน</h3>
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] shadow-xl shadow-gray-200/50 overflow-hidden border border-white">
              {Array.from({ length: 12 }).map((_, i) => i).reverse().map((monthIndex, index) => {
                const data = yearlyMonthlyTotals[monthIndex];
                if (!data) return null;
                return (
                  <div 
                    key={monthIndex}
                    onClick={() => {
                      const newDate = new Date(currentDate);
                      newDate.setMonth(monthIndex);
                      setCurrentDate(newDate);
                      setViewMode('month');
                    }}
                    className={`py-2 px-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors ${index !== 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <p className="font-black text-gray-900 text-sm">{months[monthIndex]}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">รายรับ</span>
                        <p className="text-green-600 font-black text-xs">+{data.income.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">รายจ่าย</span>
                        <p className="text-red-600 font-black text-xs">-{data.expense.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {transactions.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[3rem] shadow-inner border border-dashed border-gray-200">
            <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-50/50">
              <Wallet className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-gray-900 font-black text-xl mb-2">ยังไม่มีรายการ</h3>
            <p className="text-gray-500 font-medium">กดปุ่ม + ด้านล่างเพื่อเริ่มบันทึกรายการแรก!</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/add')}
        className="fixed bottom-10 right-8 w-18 h-18 bg-blue-600 text-white rounded-[2rem] shadow-[0_20px_50px_rgba(37,99,235,0.4)] flex items-center justify-center hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all duration-300 z-50 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Plus className="w-10 h-10 relative z-10" />
      </button>

      {/* Edit Transaction Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={closeEditModal}
        >
          <div
            className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-gray-900 font-black text-2xl">แก้ไขรายการ</h3>
                <p className="text-gray-500 text-sm font-medium">ปรับข้อมูลแล้วบันทึกทับรายการเดิม</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setEditForm((prev) => ({ ...prev, type: 'expense' }))}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    editForm.type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'
                  }`}
                >
                  รายจ่าย
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm((prev) => ({ ...prev, type: 'income' }))}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    editForm.type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'
                  }`}
                >
                  รายรับ
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">จำนวนเงิน</label>
                <input
                  type="text"
                  inputMode="text"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">หมวดหมู่</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">บันทึกเพิ่มเติม</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 h-28"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">วันเวลา</label>
                <input
                  type="datetime-local"
                  value={editForm.date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 text-red-500 p-4 rounded-full mb-6 ring-8 ring-red-50/50">
              <LogOut className="w-10 h-10" />
            </div>
            <h3 className="text-gray-900 font-black text-2xl mb-3">ออกจากระบบ?</h3>
            <p className="text-gray-500 font-semibold text-sm mb-8 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบบัญชีของคุณ?
            </p>
            <div className="flex space-x-3 w-full">
              <button 
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all duration-200 active:scale-95"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleLogout}
                className="flex-1 py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-200 transition-all duration-200 active:scale-95"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Download CSV Modal */}
      {isDownloadModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setIsDownloadModalOpen(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full mb-5 ring-8 ring-emerald-50/50">
              <Download className="w-9 h-9" />
            </div>
            <h3 className="text-gray-900 font-black text-xl mb-1">ดาวน์โหลด CSV</h3>
            <p className="text-gray-400 font-medium text-sm mb-6 leading-relaxed">
              เลือกช่วงข้อมูลที่ต้องการส่งออก
            </p>

            {/* Current scope info */}
            <div className="w-full bg-gray-50 rounded-2xl px-4 py-2.5 mb-5 text-left">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">ช่วงปัจจุบัน</p>
              <p className="text-gray-700 font-bold text-sm">
                {viewMode === 'day'
                  ? format(toZonedDate(selectedDate), 'dd MMMM yyyy', { locale: th })
                  : viewMode === 'month'
                  ? format(currentDate, 'MMMM yyyy', { locale: th })
                  : `ปี ${currentDate.getFullYear() + 543}`}
              </p>
            </div>

            <div className="flex flex-col space-y-3 w-full">
              <button
                onClick={() => handleDownloadCSV('current')}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  {viewMode === 'day' ? 'เฉพาะวันนี้' : viewMode === 'month' ? 'เฉพาะเดือนนี้' : 'เฉพาะปีนี้'}
                </span>
              </button>
              <button
                onClick={() => handleDownloadCSV('all')}
                className="w-full py-3.5 px-4 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-2xl transition-all duration-200 active:scale-95 flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>รายการทั้งหมด ({transactions.length} รายการ)</span>
              </button>
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold rounded-2xl transition-all duration-200 active:scale-95"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
