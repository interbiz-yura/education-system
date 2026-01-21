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
  const [allSRs, setAllSRs] = useState([])
  const [selectedSR, setSelectedSR] = useState('전체')
  const [teamEvents, setTeamEvents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [teamDailyVideos, setTeamDailyVideos] = useState([])
  const [teamScores, setTeamScores] = useState([])
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [availableDates, setAvailableDates] = useState([])
  const [newEventId, setNewEventId] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [message, setMessage] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [changeRequests, setChangeRequests] = useState([])

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
    // 같은 담당(department) 내 모든 매니저 조회
    const { data: members } = await supabase
      .from('users')
      .select('*')
      .eq('department', currentUser.department)
      .eq('status', 'ACTIVE')
      .eq('role', 'USER')
      .order('sr_name')
      .order('name')
    
    if (members) {
      setTeamMembers(members)
      
      // SR 목록 추출
      const uniqueSRs = [...new Set(members.map(m => m.sr_name))].filter(Boolean)
      setAllSRs(uniqueSRs)
      
      loadTeamCompletionData(members.map(m => m.id))
    }

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

    // 변경 요청 내역 로드
    const { data: requests } = await supabase
      .from('change_requests')
      .select('*')
      .eq('requested_by', currentUser.id)
    if (requests) setChangeRequests(requests)
  }

  const loadTeamCompletionData = async (userIds) => {
    const { data: videos } = await supabase
      .from('daily_video_completion')
      .select('*')
      .in('user_id', userIds)
      .eq('year_month', currentYM)
    if (videos) setTeamDailyVideos(videos)

    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .in('user_id', userIds)
      .eq('year_month', currentYM)
      .eq('score_type', 'SALES_TALK')
    if (scores) setTeamScores(scores)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  const goToDashboard = () => {
    router.push('/dashboard')
  }

  const getDday = (dateStr) => {
    const eventDate = new Date(dateStr)
    const diffTime = eventDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'D-Day'
    if (diffDays > 0) return `D-${diffDays}`
    return `D+${Math.abs(diffDays)}`
  }

  const getAlerts = () => {
    const alerts = []
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    teamEvents.forEach(evt => {
      const eventDate = new Date(evt.event_date)
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
      
      const attendees = assignments.filter(a => a.event_id === evt.id)
      const attendeeCount = attendees.length || filteredMembers.length
      
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

  const getEventGroups = () => {
    const groups = {}
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    teamEvents.forEach(evt => {
      const templateName = evt.training_templates?.name || '기타'
      
      if (templateName === '일일화상교육' || templateName === '세일즈톡 TEST') return
      
      if (!groups[templateName]) {
        groups[templateName] = {
          templateName: templateName,
          events: []
        }
      }
      
      const eventAssignments = assignments.filter(a => a.event_id === evt.id)
      let attendees = []
      
      if (eventAssignments.length > 0) {
        attendees = eventAssignments.map(a => {
          const member = filteredMembers.find(m => m.id === a.user_id)
          return member ? { ...member, eventDate: evt.event_date, eventId: evt.id } : null
        }).filter(Boolean)
      } else {
        attendees = filteredMembers.map(m => ({ ...m, eventDate: evt.event_date, eventId: evt.id }))
      }
      
      groups[templateName].events.push({
        event: evt,
        attendees: attendees,
        dday: getDday(evt.event_date)
      })
    })
    
    return Object.values(groups).map(group => {
      const allAttendees = group.events.flatMap(e => e.attendees)
      allAttendees.sort((a, b) => {
        if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
        if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
        if (a.name !== b.name) return a.name.localeCompare(b.name, 'ko')
        return new Date(a.eventDate) - new Date(b.eventDate)
      })
      
      const nearestEvent = group.events.reduce((min, e) => 
        new Date(e.event.event_date) < new Date(min.event.event_date) ? e : min
      )
      
      return {
        templateName: group.templateName,
        attendees: allAttendees,
        dday: nearestEvent.dday,
        deadline: nearestEvent.event.deadline_date,
        events: group.events
      }
    })
  }

  const getDailyVideoStatus = () => {
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    return filteredMembers.map(member => {
      const memberVideos = teamDailyVideos.filter(v => v.user_id === member.id)
      const isCompleted = memberVideos.length > 0 && memberVideos.every(v => v.is_completed)
      
      return {
        ...member,
        status: isCompleted ? '이수' : '미이수',
        isCompleted: isCompleted
      }
    }).sort((a, b) => {
      if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
      if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
      if (a.position !== b.position) return a.position.localeCompare(b.position, 'ko')
      return a.name.localeCompare(b.name, 'ko')
    })
  }

  const getSalesTalkStatus = () => {
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    return filteredMembers.map(member => {
      const score = teamScores.find(s => s.user_id === member.id)
      
      return {
        ...member,
        score: score ? score.score : null,
        status: score ? `${score.score}점` : '미제출'
      }
    }).sort((a, b) => {
      if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
      if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
      if (a.position !== b.position) return a.position.localeCompare(b.position, 'ko')
      return a.name.localeCompare(b.name, 'ko')
    })
  }

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
      // 변경 요청 목록 새로고침
      const { data: requests } = await supabase
        .from('change_requests')
        .select('*')
        .eq('requested_by', user.id)
      if (requests) setChangeRequests(requests)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const getChangeRequestStatus = (memberId, eventId) => {
    const request = changeRequests.find(
      r => r.user_id === memberId && r.original_event_id === eventId
    )
    return request ? request.status : null
  }

  const getStatusText = (status) => {
    if (status === 'PENDING') return '대기중'
    if (status === 'APPROVED') return '승인'
    if (status === 'REJECTED') return '반려'
    return null
  }

  const getStatusColor = (status) => {
    if (status === 'PENDING') return 'bg-yellow-100 text-yellow-800'
    if (status === 'APPROVED') return 'bg-green-100 text-green-800'
    if (status === 'REJECTED') return 'bg-red-100 text-red-800'
    return ''
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

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
    const getTeamEventsForDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return teamEvents.filter(e => e.event_date === dateStr)
    }

  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  const alerts = getAlerts()
  const eventGroups = getEventGroups()
  const dailyVideoStatus = getDailyVideoStatus()
  const salesTalkStatus = getSalesTalkStatus()

  const dailyVideoDeadline = teamEvents.find(e => e.training_templates?.name === '일일화상교육')?.deadline_date
  const salesTalkDeadline = teamEvents.find(e => e.training_templates?.name === '세일즈톡 TEST')?.deadline_date

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-purple-600 text-white p-4 shadow">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-bold">📚 SR 관리 페이지</h1>
          <div className="flex gap-2">
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

        {/* 본인 정보 + 캘린더 + 내 교육 현황 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-xl">👤</div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{user.name}</p>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">SR</span>
              </div>
              <p className="text-sm text-gray-500">{user.department} · {user.channel} · {user.employee_id}</p>
            </div>
          </div>

        {/* 캘린더 */}
        <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded">◀</button>
            <h3 className="font-bold">{year}년 {month + 1}월</h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">▶</button>
        </div>
        
        {/* 범례 */}
        <div className="flex items-center gap-4 mb-2 text-xs">
            <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">본인 교육</span>
            </div>
            <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">담당 인원 교육</span>
            </div>
        </div>
            
            <div className="grid grid-cols-5 gap-1 text-center text-sm">
              {['월', '화', '수', '목', '금'].map(d => (
                <div key={d} className="p-2 font-bold text-gray-500">{d}</div>
              ))}
              {weekdays.length > 0 && [...Array(weekdays[0].dayOfWeek - 1)].map((_, i) => (
                <div key={`empty-${i}`} className="p-2 min-h-[50px]"></div>
              ))}
            {weekdays.map(({ day }) => {
            const myDayEvents = getEventsForDate(day)
            const teamDayEvents = getTeamEventsForDate(day)
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString()
            
            return (
                <div 
                key={day} 
                className={`p-1 min-h-[50px] border rounded text-xs ${isToday ? 'border-purple-500 border-2 bg-purple-50' : 'border-gray-200'}`}
                >
                <span className={`${isToday ? 'text-purple-600 font-bold' : ''}`}>{day}</span>
                
                {/* 본인 교육 (빨간색) */}
                {myDayEvents.slice(0, 1).map((evt, i) => (
                    <div 
                    key={`my-${i}`} 
                    className="mt-1 bg-red-500 text-white rounded px-1 truncate text-[10px] font-medium" 
                    title={`[본인] ${evt.training_templates?.name}`}
                    >
                    {evt.training_templates?.name?.slice(0, 5)}
                    </div>
                ))}
                
                {/* 담당 인원 교육 (파란색) */}
                {teamDayEvents.slice(0, 1).map((evt, i) => (
                    <div 
                    key={`team-${i}`} 
                    className="mt-1 bg-blue-500 text-white rounded px-1 truncate text-[10px] font-medium" 
                    title={`[담당] ${evt.training_templates?.name}`}
                    >
                    {evt.training_templates?.name?.slice(0, 5)}
                    </div>
                ))}
                </div>
            )
            })}
            </div>
          </div>

          {/* 내 교육 현황 */}
          <div>
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
        </div>

        {/* SR 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            <label className="font-bold text-sm">SR 선택:</label>
            <select
              value={selectedSR}
              onChange={(e) => setSelectedSR(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="전체">전체</option>
              {allSRs.map(sr => (
                <option key={sr} value={sr}>{sr}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 ml-2">
              ({selectedSR === '전체' ? teamMembers.length : teamMembers.filter(m => m.sr_name === selectedSR).length}명)
            </span>
          </div>
        </div>

        {/* 담당 인원 교육 현황 (일정 있는 교육만) */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">👥 담당 인원 교육 현황 (일정 있는 교육)</h3>
          </div>
          
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
                    <span className="font-bold">{group.templateName}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        group.dday === 'D-Day' ? 'bg-red-500 text-white' : 
                        group.dday === 'D-1' ? 'bg-yellow-500 text-white' : 'bg-gray-500 text-white'
                      }`}>
                        {group.dday}
                      </span>
                      <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
                        엑셀 다운로드
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">교육일</th>
                          <th className="px-3 py-2 text-left">SR</th>
                          <th className="px-3 py-2 text-left">지점</th>
                          <th className="px-3 py-2 text-left">직책</th>
                          <th className="px-3 py-2 text-left">이름</th>
                          <th className="px-3 py-2 text-left">변경</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.attendees.map((member, j) => {
                          const requestStatus = getChangeRequestStatus(member.id, member.eventId)
                          const statusText = getStatusText(requestStatus)
                          const statusColor = getStatusColor(requestStatus)
                          
                          return (
                            <tr key={j} className="border-t">
                              <td className="px-3 py-2">{formatDate(member.eventDate)}</td>
                              <td className="px-3 py-2 text-gray-600">{member.sr_name}</td>
                              <td className="px-3 py-2 text-gray-600">{member.branch_name}</td>
                              <td className="px-3 py-2 text-gray-600">{member.position}</td>
                              <td className="px-3 py-2 font-medium">{member.name}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openChangeModal(member, group.events.find(e => e.event.id === member.eventId)?.event)}
                                    className="text-xs text-purple-600 hover:underline"
                                  >
                                    날짜변경
                                  </button>
                                  {statusText && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${statusColor}`}>
                                      {statusText}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-2 bg-gray-50 text-xs text-gray-500">
                    총 {group.attendees.length}명
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 일일화상교육 현황 */}
        <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
                <h3 className="font-bold">📺 일일화상교육 현황</h3>
                {dailyVideoStatus.length > 0 && (
                <span className="text-sm font-semibold text-blue-600">
                    이수율: {Math.round((dailyVideoStatus.filter(m => m.isCompleted).length / dailyVideoStatus.length) * 100)}%
                </span>
                )}
            </div>
            <div className="flex items-center gap-2">
        {dailyVideoDeadline && (
        <span className="font-bold text-bold text-red-500">마감: {formatDate(dailyVideoDeadline)}</span>
        )}
        <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
엑셀 다운로드
</button>
</div>
</div>
      {dailyVideoStatus.length === 0 ? (
        <p className="text-gray-500 text-sm">담당 인원이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">SR</th>
                  <th className="px-3 py-2 text-left">지점</th>
                  <th className="px-3 py-2 text-left">직책</th>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {dailyVideoStatus.map((member, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-gray-600">{member.sr_name}</td>
                    <td className="px-3 py-2 text-gray-600">{member.branch_name}</td>
                    <td className="px-3 py-2 text-gray-600">{member.position}</td>
                    <td className="px-3 py-2 font-medium">{member.name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${member.isCompleted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-500">
            이수: {dailyVideoStatus.filter(m => m.isCompleted).length}명 / 총 {dailyVideoStatus.length}명
          </div>
        </>
      )}
    </div>

    {/* 세일즈톡 TEST 현황 */}
    <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
            <h3 className="font-bold">📝 세일즈톡 TEST 현황</h3>
            {salesTalkStatus.length > 0 && (
            <span className="text-sm font-semibold text-blue-600">
                제출율: {Math.round((salesTalkStatus.filter(m => m.score !== null).length / salesTalkStatus.length) * 100)}%
            </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          {salesTalkDeadline && (
            <span className="font-bold text-bold text-red-500">마감: {formatDate(salesTalkDeadline)}</span>
          )}
          <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
            엑셀 다운로드
          </button>
        </div>
      </div>
      
      {salesTalkStatus.length === 0 ? (
        <p className="text-gray-500 text-sm">담당 인원이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">SR</th>
                  <th className="px-3 py-2 text-left">지점</th>
                  <th className="px-3 py-2 text-left">직책</th>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-center">점수</th>
                </tr>
              </thead>
              <tbody>
                {salesTalkStatus.map((member, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2 text-gray-600">{member.sr_name}</td>
                    <td className="px-3 py-2 text-gray-600">{member.branch_name}</td>
                    <td className="px-3 py-2 text-gray-600">{member.position}</td>
                    <td className="px-3 py-2 font-medium">{member.name}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${member.score !== null ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-gray-500">
            제출: {salesTalkStatus.filter(m => m.score !== null).length}명 / 총 {salesTalkStatus.length}명
          </div>
        </>
      )}
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