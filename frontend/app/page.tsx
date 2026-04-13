import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-[#050505] text-white selection:bg-red-600 selection:text-white">
      {/* 🚀 1. HERO SECTION (첫 화면) */}
      <section className="relative w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center overflow-hidden border-b border-[#111]">
        {/* Godly 감성의 미니멀한 배경 빛 번짐 효과 */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-600/10 blur-[120px] rounded-[100%] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:32px_32px] opacity-20 mask-image:linear-gradient(to_bottom,white,transparent)"></div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-[-10vh]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111] border border-[#333] mb-8">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase">
              System Online V2.0
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black italic tracking-tighter uppercase leading-[0.85]">
            PIT
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-neutral-300 to-neutral-700">
              WALL
            </span>
            <br />
            <span className="text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.3)]">
              DATA
            </span>
          </h1>

          <p className="mt-8 text-neutral-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            실시간 F1 주행 데이터 분석부터 글로벌 팬 커뮤니티까지. <br />
            당신의 방 안을 하이엔드 피트월(Pitwall) 데이터 센터로 만들어보세요.
          </p>

          {/* CTA 버튼 영역 */}
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="/standings"
              className="group relative px-8 py-4 bg-white text-black font-black italic uppercase tracking-wider overflow-hidden rounded-sm w-full md:w-auto text-center"
            >
              <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                Explore Season Data →
              </span>
              <div className="absolute inset-0 bg-red-600 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300 ease-out"></div>
            </Link>

            <div className="flex flex-col items-center w-full md:w-auto">
              <Link
                href="/community"
                className="w-full px-8 py-4 bg-[#0a0a0a] text-white border border-[#333] font-mono text-sm uppercase tracking-widest hover:bg-[#111] hover:border-neutral-500 transition-all text-center"
              >
                Join Community
              </Link>
              <span className="text-[10px] text-neutral-600 font-mono mt-2 tracking-widest">
                *로그인 필요
              </span>
            </div>
          </div>
        </div>

        {/* 스크롤 유도 화살표 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-bounce">
          <span className="text-[10px] font-mono tracking-widest text-neutral-500">
            SCROLL DISCOVER
          </span>
          <div className="w-[1px] h-8 bg-gradient-to-b from-neutral-500 to-transparent"></div>
        </div>
      </section>

      {/* 📊 2. FEATURES SECTION (스크롤 시 등장) */}
      <section className="py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter">
            Enterprise-Grade <br />
            <span className="text-neutral-500">Architecture.</span>
          </h2>
        </div>

        {/* Godly 스타일의 Bento Grid 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Feature 1: 텔레메트리 (크게 차지) */}
          <div className="md:col-span-2 bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-8 md:p-12 relative overflow-hidden group hover:border-[#444] transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[50px] rounded-full group-hover:bg-red-600/10 transition-colors"></div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-red-600/10 border border-red-600/20 rounded-lg flex items-center justify-center mb-6">
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  ></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-3">
                Live Telemetry
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-md">
                FIA OpenF1 API를 통한 초정밀 데이터 스트리밍. 속도, 스로틀,
                브레이크 압력까지 드라이버의 모든 조작을 실시간 차트로
                렌더링합니다. 누구나 데이터를 열람하고 분석할 수 있습니다.
              </p>
            </div>
            {/* 가짜 UI 장식 */}
            <div className="mt-8 h-32 w-full border-t border-[#333] pt-4 flex items-end gap-2 opacity-50">
              <div className="w-1/6 bg-yellow-500/20 h-[40%] rounded-t-sm"></div>
              <div className="w-1/6 bg-yellow-500/40 h-[70%] rounded-t-sm"></div>
              <div className="w-1/6 bg-yellow-500/80 h-[100%] rounded-t-sm"></div>
              <div className="w-1/6 bg-yellow-500/50 h-[60%] rounded-t-sm"></div>
            </div>
          </div>

          {/* Feature 2: 커뮤니티 */}
          <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-8 relative overflow-hidden group hover:border-[#444] transition-colors">
            <div className="relative z-10 h-full flex flex-col">
              <div className="w-10 h-10 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center mb-6">
                <svg
                  className="w-5 h-5 text-neutral-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  ></path>
                </svg>
              </div>
              <h3 className="text-2xl font-bold uppercase tracking-tight mb-3">
                Paddock Club
              </h3>
              <p className="text-neutral-400 text-sm leading-relaxed flex-1">
                전 세계 모터스포츠 팬들과 데이터를 기반으로 토론하세요.
              </p>
              <Link
                href="/login"
                className="mt-6 text-xs font-mono text-white border-b border-red-600 inline-block w-max pb-1 hover:text-red-500 transition-colors"
              >
                REQUEST ACCESS →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 🏁 Footer */}
      <footer className="border-t border-[#1a1a1a] bg-[#050505] pt-16 pb-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
          {/* 1. Brand & Info */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-600 rounded-sm"></span>
              <span className="text-xl font-black italic tracking-tighter text-white">
                PIT<span className="text-neutral-500">WALL.</span>
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-500 leading-relaxed max-w-xs">
              모터스포츠 팬들을 위해 구축된 고성능 F1 텔레메트리 대시보드 및
              실시간 데이터 분석 플랫폼입니다.
            </p>
          </div>

          {/* 2. Tech Stack (사용된 기술) */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-mono text-neutral-600 tracking-widest uppercase">
              Powered By (Tech Stack)
            </h4>
            <ul className="flex flex-col gap-2 text-xs font-mono text-neutral-400">
              <li className="flex items-center gap-2">
                {/* 👇 Jolpica 로 정확하게 명시 */}
                <span className="text-red-600">▸</span> OpenF1 & Jolpica API (F1
                Data)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">▸</span> Next.js 15 (Frontend App
                Router)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">▸</span> NestJS & MySQL (Backend
                Auth/DB)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-red-600">▸</span> Recharts & Tailwind CSS
                (UI)
              </li>
            </ul>
          </div>

          {/* 3. Connect & Creator (깃허브 및 제작자) */}
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] font-mono text-neutral-600 tracking-widest uppercase">
              Connect
            </h4>
            <ul className="flex flex-col gap-2 text-xs font-mono text-neutral-400">
              <li>
                {/* 👇 본인의 깃허브 주소로 변경하세요! */}
                <a
                  href="https://github.com/your-username"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  GitHub Repository
                </a>
              </li>
              <li className="flex items-center gap-2 text-neutral-500">
                {/* 👇 본인 이름이나 닉네임으로 변경하세요! */}
                <span className="text-neutral-700">@</span> Engineered by [본인
                닉네임]
              </li>
            </ul>
          </div>
        </div>

        {/* 하단 카피라이트 */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-[#111] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono text-neutral-600 tracking-widest uppercase">
            © {new Date().getFullYear()} F1 PITWALL PROJECT. ALL RIGHTS
            RESERVED.
          </p>
          <p className="text-[10px] font-mono text-neutral-600 tracking-widest uppercase">
            DATA OPEN-SOURCED BY{" "}
            <a
              href="https://openf1.org"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:text-white border-b border-neutral-700 mx-1 pb-0.5"
            >
              OPENF1
            </a>{" "}
            &{" "}
            {/* 👇 Jolpica 공식 웹사이트로 링크 수정 */}
            <a
              href="https://jolpi.ca"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:text-white border-b border-neutral-700 ml-1 pb-0.5"
            >
              JOLPICA
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}