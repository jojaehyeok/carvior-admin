'use client';

import GradientBg from "@/components/page/login/gradient-bg";
import LoginForm from "@/components/page/login/login-form";
import { Alert } from "antd";
import { ShieldCheck } from "lucide-react"; // Verified 대신 더 보안 느낌이 나는 아이콘 사용

const LoginPage = () => {
  return (
    <div className="flex min-h-screen bg-white items-center w-full">
      {/* 왼쪽: 브랜드 비주얼 영역 (데스크톱 전용) */}
      <div className={`relative hidden w-1/2 lg:block h-screen`}>
        <GradientBg className="absolute top-0 left-0 w-full h-full" />

        {/* 상단 로고 */}
        <div className="absolute top-10 left-10 flex items-center gap-2">
          <img src="/logo.png" className="w-12 h-12" alt="chavata logo" />
          <span className="text-white text-2xl font-black tracking-tighter">차바타</span>
        </div>

        {/* 중앙 브랜드 메시지 */}
        <div className="absolute inset-0 flex flex-col justify-center px-20 text-white">
          <h1 className="text-6xl font-bold leading-tight mb-4">
            Smart Admin<br />
            Management
          </h1>
          <p className="text-blue-100 text-lg opacity-80">
            차바타 진단 신청 및 딜러 관리 시스템에 접속하신 것을 환영합니다.
          </p>
        </div>

        {/* 하단 인증 배지 */}
        <div className="absolute inline-flex items-center gap-2 px-4 py-2 font-bold text-white border-2 border-white/30 rounded-full left-10 bottom-10 backdrop-blur-sm">
          <ShieldCheck width={20} height={20} className="text-blue-200" />
          SECURE ADMIN ACCESS
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 영역 */}
      <div className="w-full lg:w-1/2 h-screen bg-white">
        <div className="relative flex items-center justify-center h-full">
          <section className="w-full px-5 pb-10 text-gray-800 sm:w-4/6 md:w-3/6 lg:w-4/6 xl:w-3/6 sm:px-0">

            {/* 환경변수 에러 알림 (유지) */}
            {!process.env.NEXT_PUBLIC_API_ENDPOINT ? (
              <Alert
                message="환경변수 설정 오류"
                description={
                  <span>
                    .env.example 파일을 복사하여 .env 파일을 생성해주세요.{" "}
                    <a
                      href="https://github.com/purpleio/purple-admin-ui#%EA%B8%B0%EB%B3%B8-%EC%84%A4%EC%A0%95"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold"
                    >
                      참고 링크
                    </a>
                  </span>
                }
                type="error"
                showIcon
                className="my-10 rounded-xl"
              />
            ) : null}

            {/* 로그인 헤더 */}
            <div className="flex flex-col items-center justify-center px-2 mt-8 sm:mt-0 mb-10">
              <div className="lg:hidden mb-6">
                <img src="/logo.png" className="w-16 h-16" alt="logo" />
              </div>
              <h2 className="text-4xl font-black leading-tight inter tracking-tighter text-blue-600">
                CHAVATA
              </h2>
              <div className="mt-2 text-sm font-medium text-gray-400 uppercase tracking-widest">
                Management System
              </div>
            </div>

            {/* 실제 로그인 폼 컴포넌트 */}
            <div className="w-full px-2 mt-6 sm:px-6">
              <div className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100 shadow-sm">
                <LoginForm />
              </div>
              <p className="mt-8 text-center text-xs text-gray-400">
                © 2026 CARVIOR. All rights reserved.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;