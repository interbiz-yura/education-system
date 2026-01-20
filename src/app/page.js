'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('birth_date', birthDate)
      .eq('status', 'ACTIVE')
      .single()

    if (dbError || !data) {
      setError('사번 또는 생년월일이 일치하지 않습니다.')
      setLoading(false)
      return
    }

    localStorage.setItem('user', JSON.stringify(data))
    
    // 권한별 페이지 이동
        if (data.role === 'SUPER_ADMIN') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          📚 사내 교육 관리 시스템
        </h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사번
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="사번 입력"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 (생년월일 6자리)
            </label>
            <input
              type="password"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="예: 901225"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-300"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}