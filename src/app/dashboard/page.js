'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/')
      return
    }
    setUser(JSON.parse(savedUser))
    loadEvents()
  }, [])

  const loadEvents = async () => {
    const { data } = await supabase
      .from('training_events')
      .select('*, training_templates(*)')
      .eq('status', 'PUBLISHED')
    if (data) setEvents(data)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  // 캘린더 관련 함수들
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const days = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= lastDate; i++) {
    days.push(i)
  }

  // 해당 날짜의 교육 이벤트 찾기
  const getEventsForDate = (day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.event_date === dateStr)
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-blue-600 text-white p-4 shadow">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-bold">📚 교육 관리 시스템</h1>
          <button onClick={handleLogout} className="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800">
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* 개인정보 카드 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
              👤
            </div>
            <div>
              <p className="font-bold text-lg">{user.name}</p>
              <p className="text-sm text-gray-500">
                {user.channel} · {user.position} · {user.employee_id}
              </p>
              <p className="text-xs text-gray-400">{user.branch_name}</p>
            </div>
          </div>
          <div className="mt-3 inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {user.role === 'SUPER_ADMIN' ? '최고관리자' : user.role === 'MANAGER' ? 'SR' : '매니저'}
          </div>
        </div>

        {/* 캘린더 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded">◀</button>
            <h2 className="text-lg font-bold">{year}년 {month + 1}월</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">▶</button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="p-2 font-bold text-gray-500">{d}</div>
            ))}
            {days.map((day, idx) => {
              const dayEvents = getEventsForDate(day)
              const isToday = day && new Date().toDateString() === new Date(year, month, day).toDateString()
              return (
                <div 
                  key={idx} 
                  className={`p-2 min-h-[60px] border rounded ${day ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}`}
                >
                  <span className={`text-sm ${isToday ? 'text-blue-600 font-bold' : ''}`}>{day}</span>
                  {dayEvents.map((evt, i) => (
                    <div key={i} className="mt-1 text-xs bg-blue-100 text-blue-800 rounded px-1 truncate">
                      {evt.training_templates?.name || evt.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* 이번 달 교육 목록 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">📅 이번 달 교육</h3>
          {events.filter(e => {
            const eventDate = new Date(e.event_date)
            return eventDate.getMonth() === month && eventDate.getFullYear() === year
          }).length === 0 ? (
            <p className="text-gray-500 text-sm">등록된 교육이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {events.filter(e => {
                const eventDate = new Date(e.event_date)
                return eventDate.getMonth() === month && eventDate.getFullYear() === year
              }).map((evt, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">{new Date(evt.event_date).getMonth() + 1}월</div>
                    <div className="text-lg font-bold">{new Date(evt.event_date).getDate()}</div>
                  </div>
                  <div>
                    <p className="font-medium">{evt.training_templates?.name || evt.title}</p>
                    <p className="text-xs text-gray-500">{evt.start_time} {evt.location}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}