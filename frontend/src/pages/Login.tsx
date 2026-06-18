import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { LogIn, UserPlus, Wallet } from 'lucide-react';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);
        const response = await api.post('/auth/login', formData);
        localStorage.setItem('token', response.data.access_token);
        navigate('/');
      } else {
        await api.post('/auth/signup', { email, password, full_name: fullName });
        setIsLogin(true);
        setError('สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-10 transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-10">
          <div className="inline-block p-3 rounded-2xl bg-blue-50 mb-4">
            <Wallet className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Record Bil</h1>
          <p className="text-gray-500 mt-2 font-medium">{isLogin ? 'ยินดีต้อนรับกลับมา' : 'สร้างบัญชีใหม่'}</p>
        </div>

        {error && (
          <div className={`p-4 rounded-2xl mb-6 text-sm font-medium flex items-center ${error.includes('สำเร็จ') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            <span className="mr-2">●</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">ชื่อ-นามสกุล</label>
              <input
                type="text"
                placeholder="สมชาย มั่นคง"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:bg-white outline-none transition-all"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">อีเมล</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:bg-white outline-none transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">รหัสผ่าน</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 focus:bg-white outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-lg shadow-blue-200 text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all font-bold text-lg"
          >
            {isLogin ? <LogIn className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
            {isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="mt-8 flex flex-col space-y-5">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-400 font-medium">หรือเข้าใช้งานผ่าน</span>
            </div>
          </div>

          <button
            onClick={() => {/* Implement Google Login later */}}
            className="w-full flex justify-center items-center py-3.5 px-6 border border-gray-200 rounded-2xl shadow-sm bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all font-semibold"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-3" alt="Google" />
            Google Account
          </button>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-600 hover:text-blue-700 text-center font-bold tracking-wide uppercase transition-colors"
          >
            {isLogin ? 'ยังไม่มีบัญชี? สมัครสมาชิกที่นี่' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
