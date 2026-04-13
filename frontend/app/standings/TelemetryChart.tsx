"use client";

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface TelemetryProps {
  year: number;
  round: number;
  driverNumber: string;
}

export default function TelemetryChart({ year, round, driverNumber }: TelemetryProps) {
  const [data, setData] = useState<any[]>([]);
  // 💡 상태를 세분화: idle(대기) -> loading(로딩) -> success(성공) 또는 error(실패)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function fetchTelemetry() {
    if (!driverNumber || driverNumber === '0') {
      setError('차량 번호가 누락되어 추적 불가');
      setStatus('error');
      return;
    }
    if (year < 2023) {
      setError('NO TELEMETRY DATA BEFORE 2023');
      setStatus('error');
      return;
    }

    try {
      setStatus('loading');
      setError('');

      const sessionRes = await fetch(`https://api.openf1.org/v1/sessions?year=${year}&session_name=Race`);
      if (!sessionRes.ok) throw new Error('API 서버 통신 에러');
      const sessions = await sessionRes.json();
      
      // 🚨 [핵심 방어 코드] API Rate Limit 또는 비정상 응답 방어
      if (!Array.isArray(sessions)) {
        throw new Error('세션 정보를 불러오지 못했습니다. (서버 요청 초과, 잠시 후 다시 시도)');
      }

      sessions.sort((a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      const currentSession = sessions[round - 1];
      if (!currentSession) throw new Error(`라운드 ${round}의 세션 정보를 찾을 수 없습니다.`);

      const carDataRes = await fetch(`https://api.openf1.org/v1/car_data?driver_number=${driverNumber}&session_key=${currentSession.session_key}&limit=200`);
      const carData = await carDataRes.json();

      // 🚨 [핵심 방어 코드] 외부 API 오류 처리
      if (!Array.isArray(carData)) {
        throw new Error('텔레메트리 데이터를 불러오지 못했습니다. (API 제한)');
      }

      if (carData.length === 0) throw new Error('해당 세션의 수집된 텔레메트리 데이터가 없습니다.');

      const formattedData = carData.map((d: any, index: number) => ({
        time: index,
        speed: d.speed,
        throttle: d.throttle,
        brake: d.brake > 0 ? d.brake * 10 : 0, 
      }));

      setData(formattedData);
      setStatus('success');
    } catch (err: any) {
      setError(err.message || 'TELEMETRY CONNECTION FAILED');
      setStatus('error');
    }
  }

  // 🎛️ 1. 대기 상태 (클릭 전)
  if (status === 'idle') {
    return (
      <div 
        onClick={fetchTelemetry}
        className="h-10 w-full bg-[#111] rounded-md border border-[#333] flex items-center justify-center font-mono hover:bg-[#222] hover:border-red-600/50 transition-all cursor-pointer group"
      >
        <p className="text-neutral-500 text-[10px] tracking-widest group-hover:text-red-500 transition-colors flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neutral-600 group-hover:bg-red-600 rounded-full group-hover:animate-pulse"></span>
          [+] INITIATE TELEMETRY LINK FOR R{round}
        </p>
      </div>
    );
  }

  // ⏳ 2. 로딩 상태
  if (status === 'loading') {
    return (
      <div className="h-64 w-full bg-[#0a0a0a] rounded-xl border border-[#222] flex flex-col items-center justify-center font-mono relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-neutral-500 text-xs tracking-widest animate-pulse">ESTABLISHING SECURE LINK...</p>
      </div>
    );
  }

  // 🚨 3. 에러 상태
  if (status === 'error') {
    return (
      <div 
        onClick={fetchTelemetry}
        className="h-12 w-full bg-[#110505] rounded-md border border-red-900/50 flex items-center justify-center font-mono cursor-pointer hover:bg-red-900/20 transition-colors"
      >
        <p className="text-red-500/80 text-[10px] tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
          {error} (CLICK TO RETRY)
        </p>
      </div>
    );
  }

  // 📊 4. 성공 상태 (차트 렌더링)
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl font-mono text-xs z-50 relative">
          <p className="text-yellow-400 font-bold mb-1">SPEED: <span className="text-white">{payload[0]?.value} km/h</span></p>
          <p className="text-green-500">THROTTLE: <span className="text-white">{payload[1]?.value}%</span></p>
          <p className="text-red-500">BRAKE: <span className="text-white">{payload[2]?.value > 0 ? 'ON' : 'OFF'}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full bg-[#111] p-4 rounded-xl border border-[#333] relative overflow-hidden shadow-inner">
      <svg width="0" height="0">
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className="absolute top-4 left-4 z-10 flex gap-4">
        <div className="bg-[#1a1a1a] border border-[#444] px-3 py-1 rounded text-[10px] font-mono tracking-widest flex items-center gap-2">
          <span className="w-2 h-0.5 bg-yellow-400"></span>
          <span className="text-neutral-300">SPEED TRACE</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        <span className="text-green-500 text-[9px] font-mono tracking-widest">LIVE DATA CONNECTED</span>
      </div>

      <div className="mt-8 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" vertical={true} />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#555" fontSize={10} tickCount={6} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line type="monotone" dataKey="speed" stroke="#eab308" strokeWidth={3} dot={false} isAnimationActive={true} filter="url(#neon-glow)" />
            <Line type="monotone" dataKey="throttle" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="stepAfter" dataKey="brake" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" dot={false} strokeOpacity={0.8} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}