'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SRDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [myEvents, setMyEvents] = useState([])
  const [myScores, setMyScores] = useState([])
  const [dailyVideos, setDailyVideos] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [teamEvents, setTeamEvents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [availableDates, setAvailableDates] = useState([])
  const [newEventId, setNewEventId] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [message, setMessage] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/')
      return
    }
    const parsed = JSON.parse(savedUser)
    if (parsed.role !== 'MANAGER' && parsed.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }
    setUser(parsed)
    loadMyData(parsed)
    loadTeamData(parsed)
  }, [])

  const loadMyData = async (currentUser) => {
    const { data: events } = await supabase
      .from('training_events')
      .select('*, training_templates(*)')
      .eq('status', 'PUBLISHED')
    if (events) setMyEvents(events)

    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', currentUser.id)
    if (scores) setMyScores(scores)

    const { data: videos } = await supabase
      .from('daily_video_completion')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('year_month', currentYM)
    if (videos) setDailyVideos(videos)
  }

  const loadTeamData = async (currentUser) => {
    const { data: members } = await supabase
      .from('users')
      .select('*')
      .eq('sr_name', currentUser.name)
      .eq('status', 'ACTIVE')
      .neq('role', 'MANAGER')
      .order('name')
    if (members) setTeamMembers(members)

    const { data: events } = await supabase
      .from('training_events')
      .select('*, training_templates(*)')
      .eq('status', 'PUBLISHED')
      .gte('event_date', today.toISOString().split('T')[0])
      .order('event_date')
    if (events) setTeamEvents(events)

    const { data: assigns } = await supabase
      .from('training_assignments')
      .select('*')
    if (assigns) setAssignments(assigns)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  const goToDashboard = () => {
    router.push('/dashboard')
  }

  // D-day 계산
  const getDday = (dateStr) => {
    const eventDate = new Date(dateStr)
    const diffTime = eventDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'D-Day'
    if (diffDays > 0) return `D-${diffDays}`
    return `D+${Math.abs(diffDays)}`
  }

  // 오늘/내일 알림 생성
  const getAlerts = () => {
    const alerts = []
    
    teamEvents.forEach(evt => {
      const eventDate = new Date(evt.event_date)
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
      
      // 해당 교육 참석자 수
      const attendees = assignments.filter(a => a.event_id === evt.id)
      const attendeeCount = attendees.length || teamMembers.length // 배정 없으면 전체로 가정
      
      if (eventDateOnly.getTime() === today.getTime()) {
        alerts.push({
          type: 'danger',
          icon: '🔴',
          text: `오늘 "${evt.training_templates?.name}" 예정! 참석자 ${attendeeCount}명`
        })
      } else if (eventDateOnly.getTime() === tomorrow.getTime()) {
        alerts.push({
          type: 'warning',
          icon: '🟡',
          text: `내일 "${evt.training_templates?.name}" 예정! 참석자 ${attendeeCount}명`
        })
      }
      
      // 마감일 알림
      if (evt.deadline_date) {
        const deadlineDate = new Date(evt.deadline_date)
        const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
        
        if (deadlineDateOnly.getTime() === today.getTime()) {
          alerts.push({
            type: 'danger',
            icon: '🔴',
            text: `오늘 "${evt.training_templates?.name}" 마감!`
          })
        } else if (deadlineDateOnly.getTime() === tomorrow.getTime()) {
          alerts.push({
            type: 'warning',
            icon: '🟡',
            text: `내일 "${evt.training_templates?.name}" 마감!`
          })
        }
      }
    })
    
    return alerts
  }

  // 교육별 참석자 그룹핑
  const getEventGroups = () => {
    const groups = []
    
    teamEvents.forEach(evt => {
      // 해당 교육에 배정된 인원 또는 전체 인원
      const eventAssignments = assignments.filter(a => a.event_id === evt.id)
      let attendees = []
      
      if (eventAssignments.length > 0) {
        attendees = eventAssignments.map(a => {
          const member = teamMembers.find(m => m.id === a.user_id)
          return member
        }).filter(Boolean)
      } else {
        // 배정 없으면 해당 교육 대상자 전체 (임시로 전체 표시)
        attendees = teamMembers
      }
      
      if (attendees.length > 0) {
        groups.push({
          event: evt,
          attendees: attendees,
          dday: getDday(evt.event_date)
        })
      }
    })
    
    return groups
  }

  // 변경 요청 모달
  const openChangeModal = async (member, event) => {
    setSelectedMember(member)
    setSelectedEvent(event)
    
    const sameDates = teamEvents.filter(e => 
      e.template_id === event.template_id && 
      e.id !== event.id &&
      new Date(e.event_date) > new Date()
    )
    setAvailableDates(sameDates)
    setShowChangeModal(true)
  }

  const submitChangeRequest = async () => {
    if (!newEventId) {
      setMessage('변경할 날짜를 선택해주세요.')
      return
    }

    const { error } = await supabase
      .from('change_requests')
      .insert({
        user_id: selectedMember.id,
        original_event_id: selectedEvent.id,
        requested_event_id: newEventId,
        reason: changeReason,
        status: 'PENDING',
        requested_by: user.id
      })

    if (error) {
      setMessage('요청 실패: ' + error.message)
    } else {
      setMessage('변경 요청이 등록되었습니다.')
      setShowChangeModal(false)
      setNewEventId('')
      setChangeReason('')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // 캘린더
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
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return myEvents.filter(e => e.event_date === dateStr)
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  const alerts = getAlerts()
  const eventGroups = getEventGroups()

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-purple-600 text-white p-4 shadow">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-bold">📚 SR 관리 페이지</h1>
          <div className="flex gap-2">
            <button onClick={goToDashboard} className="text-sm bg-purple-700 px-3 py-1 rounded hover:bg-purple-800">
              내 대시보드
            </button>
            <button onClick={handleLogout} className="text-sm bg-purple-700 px-3 py-1 rounded hover:bg-purple-800">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {message && (
          <div className={`p-3 rounded ${message.includes('실패') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message}
          </div>
        )}

        {/* 오늘의 알림 */}
        {alerts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <h3 className="font-bold mb-2">🔔 오늘의 알림</h3>
            <div className="space-y-1">
              {alerts.map((alert, i) => (
                <p key={i} className={`text-sm ${alert.type === 'danger' ? 'text-red-600 font-semibold' : 'text-yellow-700'}`}>
                  {alert.icon} {alert.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 본인 정보 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-xl">👤</div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{user.name}</p>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">SR</span>
              </div>
              <p className="text-sm text-gray-500">{user.channel} · {user.employee_id}</p>
            </div>
          </div>
        </div>

        {/* 내 캘린더 */}
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
              <div key={`empty-${i}`} className="p-2 min-h-[50px]"></div>
            ))}
            {weekdays.map(({ day }) => {
              const dayEvents = getEventsForDate(day)
              const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()
              return (
                <div 
                  key={day} 
                  className={`p-1 min-h-[50px] border rounded text-xs ${isToday ? 'border-purple-500 border-2 bg-purple-50' : 'border-gray-200'}`}
                >
                  <span className={`${isToday ? 'text-purple-600 font-bold' : ''}`}>{day}</span>
                  {dayEvents.slice(0, 2).map((evt, i) => (
                    <div key={i} className="mt-1 bg-purple-100 text-purple-800 rounded px-1 truncate">
                      {evt.training_templates?.name?.slice(0, 4)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>


        {/* 내 교육 현황 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">📚 내 교육 현황</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 mb-1">일일화상교육</p>
                <p className={`font-bold ${dailyVideos.length > 0 && dailyVideos.every(v => v.is_completed) ? 'text-green-600' : 'text-gray-400'}`}>
                {dailyVideos.length > 0 && dailyVideos.every(v => v.is_completed) ? '이수' : '미이수'}
                </p>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
                <p className="text-xs text-gray-500 mb-1">세일즈톡 TEST</p>
              <p className="font-bold text-gray-600">
                {myScores.find(s => s.score_type === 'SALES_TALK' && s.year_month === currentYM)?.score || '-'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
              <p className="text-xs text-gray-500 mb-1">거점+판경상</p>
              <p className="font-bold text-gray-600">-</p>
            </div>
            <div className="p-3 bg-gray-50 rounded text-center">
              <p className="text-xs text-gray-500 mb-1">리더의 품격</p>
              <p className="font-bold text-gray-600">-</p>
            </div>
          </div>
        </div>


        {/* 담당 인원 교육 현황 (교육 중심) */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">👥 담당 인원 교육 현황</h3>
          
          {eventGroups.length === 0 ? (
            <p className="text-gray-500 text-sm">예정된 교육이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {eventGroups.map((group, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                  <div className={`p-3 flex justify-between items-center ${
                    group.dday === 'D-Day' ? 'bg-red-100' : 
                    group.dday === 'D-1' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    <div>
                      <span className="font-bold">{group.event.training_templates?.name}</span>
                      <span className="ml-2 text-sm text-gray-600">{formatDate(group.event.event_date)}</span>
                      {group.event.start_time && (
                        <span className="ml-2 text-sm text-gray-500">{group.event.start_time?.slice(0,5)}</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      group.dday === 'D-Day' ? 'bg-red-500 text-white' : 
                      group.dday === 'D-1' ? 'bg-yellow-500 text-white' : 'bg-gray-500 text-white'
                    }`}>
                      {group.dday}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="space-y-1">
                      {group.attendees.map((member, j) => (
                        <div key={j} className="flex justify-between items-center py-1 border-b last:border-0">
                          <div>
                            <span className="font-medium">{member.name}</span>
                            <span className="ml-2 text-sm text-gray-500">({member.branch_name})</span>
                          </div>
                          {group.event.training_templates?.change_requestable && (
                            <button
                              onClick={() => openChangeModal(member, group.event)}
                              className="text-xs text-purple-600 hover:underline px-2 py-1"
                            >
                              날짜변경
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">총 {group.attendees.length}명</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 엑셀 다운로드 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">📥 엑셀 다운로드</h3>
          <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
            담당 인원 명단 다운로드
          </button>
        </div>
      </main>

      {/* 변경 요청 모달 */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">📅 교육일 변경 요청</h3>
            
            <div className="space-y-3 mb-4">
              <p><strong>대상자:</strong> {selectedMember?.name}</p>
              <p><strong>교육:</strong> {selectedEvent?.training_templates?.name}</p>
              <p><strong>현재 교육일:</strong> {formatDate(selectedEvent?.event_date)}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">변경 희망일 *</label>
              <select
                value={newEventId}
                onChange={(e) => setNewEventId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">선택하세요</option>
                {availableDates.map(evt => (
                  <option key={evt.id} value={evt.id}>
                    {formatDate(evt.event_date)} ({evt.start_time?.slice(0,5)})
                  </option>
                ))}
              </select>
              {availableDates.length === 0 && (
                <p className="text-xs text-red-500 mt-1">변경 가능한 다른 날짜가 없습니다.</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">변경 사유</label>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={2}
                placeholder="사유 입력 (선택)"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitChangeRequest}
                disabled={availableDates.length === 0}
                className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-300"
              >
                변경 요청
              </button>
              <button
                onClick={() => setShowChangeModal(false)}
                className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}