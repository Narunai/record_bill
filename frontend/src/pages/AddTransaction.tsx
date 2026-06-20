import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ChevronLeft, Save } from 'lucide-react';

const AddTransaction: React.FC = () => {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [frequentCategories, setFrequentCategories] = useState<{ category: string }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFrequentCategories();
  }, [type]);

  const fetchFrequentCategories = async () => {
    try {
      const response = await api.get(`/transactions/frequent?type=${type}`);
      setFrequentCategories(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;
    try {
      await api.post('/transactions/', {
        type,
        amount,
        amount_text: amount,
        category,
        note,
        date: new Date().toISOString(),
      });
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white p-6 flex items-center shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <button 
          onClick={() => navigate(-1)} 
          className="p-3 hover:bg-gray-100 rounded-2xl transition-all active:scale-90"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="flex-1 text-center font-black text-gray-900 text-xl mr-12 tracking-tight">เพิ่มรายการใหม่</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Type Toggle */}
        <div className="flex bg-gray-200/50 p-1.5 rounded-[2rem] border border-gray-200 shadow-inner">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all duration-300 ${
              type === 'expense' 
                ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            รายจ่าย
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all duration-300 ${
              type === 'income' 
                ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            รายรับ
          </button>
        </div>

        {/* Amount Input */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border border-white relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${type === 'expense' ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">ระบุจำนวนเงิน</label>
          <div className="relative flex items-end">
            <span className={`text-4xl font-black mb-3 mr-3 transition-colors duration-500 ${type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>฿</span>
            <input
              type="text"
              inputMode="text"
              placeholder="200+500+1000 / 200 500 1000 / ค่าอาหาร 200 ข้าว 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-6xl font-black bg-transparent focus:outline-none transition-all placeholder:text-gray-100 tracking-tighter"
              autoFocus
              required
            />
          </div>
          <p className="text-xs font-medium text-gray-400 mt-2">
            พิมพ์ได้ทั้ง `200+500+1000`, `200 500 1000` หรือ `ค่าอาหาร 200 ข้าว 500`
          </p>
        </div>

        {/* Category Input & Frequent Buttons */}
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">หมวดหมู่รายการ</label>
            <input
              type="text"
              placeholder="เช่น อาหาร, เดินทาง, เงินเดือน..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-5 bg-white rounded-3xl border border-gray-100 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:outline-none shadow-sm font-bold text-lg transition-all"
              required
            />
          </div>
          
          {frequentCategories.length > 0 && (
            <div className="flex flex-wrap gap-3 px-1">
              {frequentCategories.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => setCategory(item.category)}
                  className="px-5 py-2.5 bg-white text-blue-600 rounded-2xl text-sm font-bold border border-blue-50 shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 active:scale-95 transition-all"
                >
                  {item.category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note Input */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4">บันทึกเพิ่มเติม (ไม่บังคับ)</label>
          <textarea
            placeholder="รายละเอียดที่คุณต้องการจำ..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-5 bg-white rounded-3xl border border-gray-100 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:outline-none shadow-sm h-32 font-medium transition-all"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4 pb-10">
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black text-xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:bg-blue-700 hover:shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 group"
          >
            <Save className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            <span>บันทึกรายการ</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTransaction;
