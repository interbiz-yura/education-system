'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [hqProgress, setHqProgress] = useState(null)
  const [scores, setScores] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [dailyVideos, setDailyVideos] = useState([])

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/')
      return
    }
    const parsed = JSON.parse(savedUser)
    setUser(parsed)
    
    const now = new Date()
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    
    loadEvents()
    loadHQProgress(parsed.id)
    loadScores(parsed.id)
    loadDailyVideos(parsed.id, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  const loadEvents = async () => {
    const { data } = await supabase
      .from('training_events')
      .select('*, training_templates(*)')
      .eq('status', 'PUBLISHED')
    if (data) setEvents(data)
  }

  const loadHQProgress = async (userId) => {
    const { data } = await supabase
      .from('hq_education_progress')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (data) setHqProgress(data)
  }

  const loadScores = async (userId) => {
    const { data } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', userId)
      .order('year_month', { ascending: false })
    if (data) setScores(data)
  }

  const loadDailyVideos = async (userId, yearMonth) => {
    const { data } = await supabase
      .from('daily_video_completion')
      .select('*')
      .eq('user_id', userId)
      .eq('year_month', yearMonth)
    if (data) setDailyVideos(data)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  const getBeseText = (level) => {
    const levels = ['미이수', '기본', '심화', '판매스킬', 'DC검정']
    return levels[level] || '미이수'
  }

  const getScore = (type, month) => {
    const found = scores.find(s => s.score_type === type && s.year_month === month)
    return found ? found.score : '-'
  }

  const getRecentScores = (type) => {
    const result = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const found = scores.find(s => s.score_type === type && s.year_month === ym)
      result.push({
        month: `${d.getMonth() + 1}월`,
        score: found ? found.score : null
      })
    }
    return result
  }

  // 교육 완료 상태 체크
  const getEducationStatus = (templateName) => {
    const now = new Date()
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    if (templateName === '세일즈톡 TEST') {
      const score = scores.find(s => s.score_type === 'SALES_TALK' && s.year_month === currentYM)
      return score ? 'completed' : 'pending'
    }
    if (templateName === '일일화상교육') {
      const allCompleted = dailyVideos.length > 0 && dailyVideos.every(v => v.is_completed)
      return allCompleted ? 'completed' : 'pending'
    }
    return 'pending'
  }

  // 캘린더 (월~금)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const getWeekdaysInMonth = () => {
    const days = []
    const lastDate = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(year, month, d)
      const dayOfWeek = date.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push({ day: d, dayOfWeek })
      }
    }
    return days
  }

  const weekdays = getWeekdaysInMonth()

  const getEventsForDate = (day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.event_date === dateStr)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  const rpScores = getRecentScores('RP')
  const testScores = getRecentScores('COMPETENCY_TEST')
  
  const currentMonthEvents = events.filter(e => {
    const eventDate = new Date(e.event_date)
    return eventDate.getMonth() === month && eventDate.getFullYear() === year
  })

  const getRoleBadge = (role) => {
    if (role === 'SUPER_ADMIN') return { text: '관리자', color: 'bg-red-100 text-red-800' }
    if (role === 'MANAGER') return { text: 'SR', color: 'bg-purple-100 text-purple-800' }
    return { text: '매니저', color: 'bg-blue-100 text-blue-800' }
  }

  const roleBadge = getRoleBadge(user.role)

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-bold">📚 교육 관리 시스템</h1>
          <button onClick={handleLogout} className="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800">
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* 개인정보 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">👤</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{user.name}</p>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleBadge.color}`}>
                  {roleBadge.text}
                </span>
              </div>
              <p className="text-sm text-gray-500">{user.channel} · {user.position} · {user.employee_id}</p>
              <p className="text-xs text-gray-400">{user.branch_name}</p>
            </div>
          </div>
        </div>

        {/* 캘린더 (월~금) */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded">◀</button>
            <h2 className="text-lg font-bold">{year}년 {month + 1}월</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">▶</button>
          </div>
          
          <div className="grid grid-cols-5 gap-1 text-center text-sm">
            {['월', '화', '수', '목', '금'].map(d => (
              <div key={d} className="p-2 font-bold text-gray-500">{d}</div>
            ))}
            {weekdays.length > 0 && [...Array(weekdays[0].dayOfWeek - 1)].map((_, i) => (
              <div key={`empty-${i}`} className="p-2 min-h-[60px]"></div>
            ))}
            {weekdays.map(({ day }) => {
              const dayEvents = getEventsForDate(day)
              const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()
              return (
                <div 
                  key={day} 
                  className={`p-2 min-h-[60px] border rounded bg-white ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}`}
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

        {/* 이번 달 교육 */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-bold mb-3">📅 이번 달 교육</h3>
                  <p className="text-xs text-gray-400 mb-3">※ 이수 현황은 담당자 업로드 후 반영됩니다.</p>
                  
                  {currentMonthEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm">등록된 교육이 없습니다.</p>
                  ) : (
                    <div className="space-y-3">
                      {currentMonthEvents.map((evt, i) => {
                        const templateName = evt.training_templates?.name || evt.title
                        const status = getEducationStatus(templateName)
                        const isPassed = new Date(evt.event_date) < new Date()
                        
                        // 교육장 주소 매핑 (임시)
                        const locationAddresses = {
                          '서울교육장': '서울시 강남구 테헤란로 123',
                          '부산교육장': '부산시 해운대구 센텀중앙로 456',
                          '대전교육장': '대전시 유성구 대덕대로 789'
                        }
                        
                        return (
                          <div key={i} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-blue-600">{formatDate(evt.event_date)}</span>
                                <span className="font-medium">{templateName}</span>
                              </div>
                              
                              {/* 이수 여부 뱃지 */}
                              {(templateName === '역량강화교육' || templateName === '리더의 품격' || 
                                templateName === '지점방문코칭' || templateName === '스타터 과정' || 
                                templateName === '리스타터 과정') && isPassed && (
                                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">이수</span>
                              )}
                              {templateName === '본부교육' && isPassed && (
                                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">참석 완료</span>
                              )}
                              {templateName === '세일즈톡 TEST' && status === 'completed' && (
                                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">이수</span>
                              )}
                              {templateName === '일일화상교육' && status === 'completed' && (
                                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">이수</span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              {/* 역량강화교육, 리더의 품격 */}
                              {(templateName === '역량강화교육' || templateName === '리더의 품격') && (
                                <>
                                  {evt.start_time && evt.end_time && (
                                    <p>🕐 {evt.start_time.slice(0,5)} ~ {evt.end_time.slice(0,5)}</p>
                                  )}
                                  <p>📍 ZOOM</p>
                                  {evt.meeting_id && (
                                    <p>🆔 회의 ID: {evt.meeting_id} / PW: {evt.meeting_password || '0000'}</p>
                                  )}
                                </>
                              )}
                              
                              {/* 세일즈톡 TEST */}
                              {templateName === '세일즈톡 TEST' && (
                                <>
                                  {evt.deadline_date && (
                                    <p>⏰ 완료 마감: {formatDate(evt.deadline_date)}</p>
                                  )}
                                  <p>📍 배움마당</p>
                                </>
                              )}
                              
                              {/* 일일화상교육 */}
                              {templateName === '일일화상교육' && (
                                <>
                                  {evt.deadline_date && (
                                    <p>⏰ 완료 마감: {formatDate(evt.deadline_date)}</p>
                                  )}
                                  <p>📍 배움마당</p>
                                </>
                              )}
                              
                              {/* 거점교육, 거점+판경상, 구독 저성과 교육 */}
                              {(templateName === '거점교육' || templateName === '거점+판경상' || templateName === '구독 저성과 교육') && (
                                <>
                                  {evt.start_time && evt.end_time && (
                                    <p>🕐 {evt.start_time.slice(0,5)} ~ {evt.end_time.slice(0,5)}</p>
                                  )}
                                  <p>📍 오프라인</p>
                                  {evt.location_detail && (
                                    <p className="text-xs text-gray-500">
                                      {evt.location_detail} - {locationAddresses[evt.location_detail] || '주소 미등록'}
                                    </p>
                                  )}
                                </>
                              )}
                              
                              {/* 본부교육 */}
                              {templateName === '본부교육' && (
                                <>
                                  {evt.end_date ? (
                                    <p>📅 {formatDate(evt.event_date)} ~ {formatDate(evt.end_date)}</p>
                                  ) : (
                                    <p>📅 {formatDate(evt.event_date)}</p>
                                  )}
                                  <p>📍 오프라인</p>
                                  {evt.location_detail && (
                                    <p className="text-xs text-gray-500">
                                      {evt.location_detail} - {locationAddresses[evt.location_detail] || '주소 미등록'}
                                    </p>
                                  )}
                                </>
                              )}
                              
                              {/* 지점방문코칭, 스타터/리스타터 과정 */}
                              {(templateName === '지점방문코칭' || templateName === '스타터 과정' || templateName === '리스타터 과정') && (
                                <p>📍 {user.branch_name}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

        {/* 일일화상교육 이수현황 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">📺 일일화상교육 이수현황 ({month + 1}월)</h3>
          <p className="text-xs text-gray-400 mb-3">※ 이수 현황은 담당자 업로드 후 반영됩니다.</p>
          
          {dailyVideos.length === 0 ? (
            <p className="text-gray-500 text-sm">이번 달 등록된 교육이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {dailyVideos.map((video, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <p className="text-sm flex-1 truncate pr-2" title={video.video_name}>
                    {video.video_name}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${video.is_completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {video.is_completed ? '이수' : '미이수'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 본부교육 이수현황 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">🎓 본부교육 이수현황</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500 mb-1">베세</p>
              <p className={`font-bold ${hqProgress?.bese_level > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {hqProgress ? getBeseText(hqProgress.bese_level) : '미이수'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500 mb-1">세일즈업</p>
              <p className={`font-bold ${hqProgress?.sales_up ? 'text-green-600' : 'text-gray-400'}`}>
                {hqProgress?.sales_up ? '이수' : '미이수'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <p className="text-xs text-gray-500 mb-1">PC판매사</p>
              <p className={`font-bold ${hqProgress?.pc_sales ? 'text-green-600' : 'text-gray-400'}`}>
                {hqProgress?.pc_sales ? '이수' : '미이수'}
              </p>
            </div>
          </div>
        </div>

        {/* 점수 현황 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">📊 점수 현황</h3>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {[...Array(6)].map((_, i) => {
                const d = new Date()
                d.setMonth(d.getMonth() - i)
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                return <option key={ym} value={ym}>{d.getFullYear()}년 {d.getMonth() + 1}월</option>
              })}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <p className="text-xs text-gray-500 mb-1">R/P 점수</p>
              <p className="text-2xl font-bold text-blue-600">{getScore('RP', selectedMonth)}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <p className="text-xs text-gray-500 mb-1">역량강화 TEST</p>
              <p className="text-2xl font-bold text-green-600">{getScore('COMPETENCY_TEST', selectedMonth)}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">📈 최근 6개월 추이</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">R/P</p>
                <div className="flex items-end gap-1 h-16">
                  {rpScores.map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-blue-400 rounded-t"
                        style={{ height: s.score ? `${(s.score / 100) * 100}%` : '4px', minHeight: '4px' }}
                      ></div>
                      <span className="text-xs mt-1">{s.month}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">역량강화</p>
                <div className="flex items-end gap-1 h-16">
                  {testScores.map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-green-400 rounded-t"
                        style={{ height: s.score ? `${(s.score / 10) * 100}%` : '4px', minHeight: '4px' }}
                      ></div>
                      <span className="text-xs mt-1">{s.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}