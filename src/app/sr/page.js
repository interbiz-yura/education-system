'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SRDashboard() {
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
    const [dailyVideoTab, setDailyVideoTab] = useState('my')
    const [myDailyVideos, setMyDailyVideos] = useState([])
    const [showAddTrainingModal, setShowAddTrainingModal] = useState(false)
    const [newTraining, setNewTraining] = useState({
    title: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location_type: 'ZOOM',
    meeting_id: '',
    meeting_password: '0000',
    location_detail: '',
    memo: '',
    selected_members: []
    })

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

    // SR용 영상 (본인)
    const { data: srVideos } = await supabase
        .from('daily_video_completion')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('year_month', currentYM)
        .eq('video_type', 'SR')
    if (srVideos) setMyDailyVideos(srVideos)

    // 매니저용 영상 (본인 - 내 교육 현황 표시용)
    const { data: videos } = await supabase
        .from('daily_video_completion')
        .select('*')
        .eq('user_id', currentUser.id)  // ← userIds 대신 currentUser.id
        .eq('year_month', currentYM)
        .eq('video_type', 'MANAGER')
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

    const handleAddTraining = async () => {
    if (!newTraining.title || !newTraining.event_date) {
        setMessage('교육명과 교육일은 필수입니다.')
        setTimeout(() => setMessage(''), 3000)
        return
    }

    // 교육 이벤트 생성
    const { data: eventData, error: eventError } = await supabase
        .from('training_events')
        .insert({
        title: newTraining.title,
        event_date: newTraining.event_date,
        start_time: newTraining.start_time || null,
        end_time: newTraining.end_time || null,
        meeting_id: newTraining.location_type === 'ZOOM' ? newTraining.meeting_id : null,
        meeting_password: newTraining.location_type === 'ZOOM' ? newTraining.meeting_password : null,
        location_detail: newTraining.location_type === 'OFFLINE' ? newTraining.location_detail : null,
        status: 'PUBLISHED',
        is_custom: true,
        created_by_sr: user.id
        })
        .select()
        .single()

    if (eventError) {
        setMessage('교육 추가 실패: ' + eventError.message)
        setTimeout(() => setMessage(''), 3000)
        return
    }

    // 대상자 배정
    if (newTraining.selected_members.length > 0) {
        const assignments = newTraining.selected_members.map(memberId => ({
        user_id: memberId,
        event_id: eventData.id
        }))

        await supabase
        .from('training_assignments')
        .insert(assignments)
    }

    setMessage('✅ 교육이 추가되었습니다.')
    setShowAddTrainingModal(false)
    setNewTraining({
        title: '',
        event_date: '',
        start_time: '',
        end_time: '',
        location_type: 'ZOOM',
        meeting_id: '',
        meeting_password: '0000',
        location_detail: '',
        memo: '',
        selected_members: []
    })
    loadTeamData(user)
    setTimeout(() => setMessage(''), 3000)
    }

    const toggleMemberSelection = (memberId) => {
    setNewTraining(prev => ({
        ...prev,
        selected_members: prev.selected_members.includes(memberId)
        ? prev.selected_members.filter(id => id !== memberId)
        : [...prev.selected_members, memberId]
    }))
    }

    const toggleAllMembers = () => {
    if (newTraining.selected_members.length === teamMembers.length) {
        setNewTraining(prev => ({ ...prev, selected_members: [] }))
    } else {
        setNewTraining(prev => ({ ...prev, selected_members: teamMembers.map(m => m.id) }))
    }
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
        
        // 일일화상, 세일즈톡, 자체교육 제외
        if (templateName === '일일화상교육' || templateName === '세일즈톡 TEST') return
        if (evt.is_custom) return
        
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
        attendees: attendees
        })
    })
    
    const getCustomTrainings = () => {
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    // 자체 교육만 필터링
    const customEvents = teamEvents.filter(e => e.is_custom)
    
    return customEvents.map(evt => {
        const eventAssignments = assignments.filter(a => a.event_id === evt.id)
        let attendees = []
        
        if (eventAssignments.length > 0) {
        attendees = eventAssignments.map(a => {
            const member = filteredMembers.find(m => m.id === a.user_id)
            return member ? { ...member, eventDate: evt.event_date, eventId: evt.id } : null
        }).filter(Boolean)
        }
        
        attendees.sort((a, b) => {
        if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
        if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
        return a.name.localeCompare(b.name, 'ko')
        })
        
        return {
        event: evt,
        attendees: attendees
        }
    }).sort((a, b) => new Date(a.event.event_date) - new Date(b.event.event_date))
    }

    
        return Object.values(groups).map(group => {
        const allAttendees = group.events.flatMap(e => e.attendees)
        allAttendees.sort((a, b) => {
        // 교육일 순으로 먼저 정렬
        const dateA = new Date(a.eventDate)
        const dateB = new Date(b.eventDate)
        if (dateA.getTime() !== dateB.getTime()) return dateA - dateB
        
        if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
        if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
        return a.name.localeCompare(b.name, 'ko')
        })
        
        return {
        templateName: group.templateName,
        attendees: allAttendees,
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

    const getCustomTrainings = () => {
    const filteredMembers = selectedSR === '전체' ? teamMembers : teamMembers.filter(m => m.sr_name === selectedSR)
    
    // 자체 교육만 필터링
    const customEvents = teamEvents.filter(e => e.is_custom)
    
    return customEvents.map(evt => {
        const eventAssignments = assignments.filter(a => a.event_id === evt.id)
        let attendees = []
        
        if (eventAssignments.length > 0) {
        attendees = eventAssignments.map(a => {
            const member = filteredMembers.find(m => m.id === a.user_id)
            return member ? { ...member, eventDate: evt.event_date, eventId: evt.id } : null
        }).filter(Boolean)
        }
        
        attendees.sort((a, b) => {
        if (a.sr_name !== b.sr_name) return a.sr_name.localeCompare(b.sr_name, 'ko')
        if (a.branch_name !== b.branch_name) return a.branch_name.localeCompare(b.branch_name, 'ko')
        return a.name.localeCompare(b.name, 'ko')
        })
        
        return {
        event: evt,
        attendees: attendees
        }
    }).sort((a, b) => new Date(a.event.event_date) - new Date(b.event.event_date))
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
    // 실제 교육일이 있는 것만 (마감기한 교육 제외)
    return myEvents.filter(e => {
        if (e.event_date !== dateStr) return false
        // 세일즈톡, 일일화상 같은 마감기한만 있는 교육 제외
        if (e.training_templates?.name === '세일즈톡 TEST') return false
        if (e.training_templates?.name === '일일화상교육') return false
        return true
    })
    }
    const getTeamEventsForDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // 실제 교육일이 있는 것만
    return teamEvents.filter(e => {
        if (e.event_date !== dateStr) return false
        if (e.training_templates?.name === '세일즈톡 TEST') return false
        if (e.training_templates?.name === '일일화상교육') return false
        return true
    })
    }

  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  const alerts = getAlerts()
  const eventGroups = getEventGroups()
  const dailyVideoStatus = getDailyVideoStatus()
  const salesTalkStatus = getSalesTalkStatus()
  const customTrainings = getCustomTrainings()

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
                {myDayEvents.map((evt, i) => (
                <div 
                    key={`my-${i}`} 
                    className="mt-1 bg-red-500 text-white rounded px-1 truncate text-[10px] font-medium" 
                    title={`[본인] ${evt.training_templates?.name || evt.title}`}
                >
                    {(evt.training_templates?.name || evt.title)?.slice(0, 8)}
                </div>
                ))}

                {/* 담당 인원 교육 (파란색) */}
                {teamDayEvents.map((evt, i) => (
                <div 
                    key={`team-${i}`} 
                    className="mt-1 bg-blue-500 text-white rounded px-1 truncate text-[10px] font-medium" 
                    title={`[담당] ${evt.training_templates?.name || evt.title}`}
                >
                    {(evt.training_templates?.name || evt.title)?.slice(0, 8)}
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
                {/* 일일화상교육 (SR용) - 이수율 */}
                <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">일일화상교육 (SR용)</p>
                {myDailyVideos.length > 0 ? (
                    <p className="font-bold text-blue-600">
                    {Math.round((myDailyVideos.filter(v => v.is_completed).length / myDailyVideos.length) * 100)}%
                    </p>
                ) : (
                    <p className="font-bold text-gray-400">-</p>
                )}
                </div>
                
                {/* 세일즈톡 TEST */}
                <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">세일즈톡 TEST</p>
                <p className="font-bold text-gray-600">
                    {myScores.find(s => s.score_type === 'SALES_TALK' && s.year_month === currentYM)?.score || '-'}
                </p>
                </div>
                
  

                {/* 거점+판경상 */}
                <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">거점+판경상</p>
                {(() => {
                    const event = myEvents.find(e => 
                    e.training_templates?.name === '거점+판경상' && 
                    new Date(e.event_date).getMonth() === month &&
                    new Date(e.event_date).getFullYear() === year
                    )
                    return event ? (
                    <>
                        <p className="font-bold text-gray-800">{formatDate(event.event_date)}</p>
                        {event.location_detail && (
                        <p className="text-xs text-gray-500 mt-1">{event.location_detail}</p>
                        )}
                    </>
                    ) : (
                    <p className="font-bold text-gray-400">-</p>
                    )
                })()}
                </div>
                
                {/* 리더의 품격 */}
                <div className="p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-500 mb-1">리더의 품격</p>
                {(() => {
                    const event = myEvents.find(e => 
                    e.training_templates?.name === '리더의 품격' && 
                    new Date(e.event_date).getMonth() === month &&
                    new Date(e.event_date).getFullYear() === year
                    )
                    return event ? (
                    <>
                        <p className="font-bold text-gray-800">{formatDate(event.event_date)}</p>
                        {event.meeting_id && (
                        <p className="text-xs text-gray-500 mt-1">
                            ID: {event.meeting_id}<br/>PW: {event.meeting_password || '0000'}
                        </p>
                        )}
                    </>
                    ) : (
                    <p className="font-bold text-gray-400">-</p>
                    )
                })()}
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
            <button
            onClick={() => setShowAddTrainingModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center gap-1"
            >
            <span>+</span> 교육 추가하기
            </button>
        </div>
        
        {eventGroups.length === 0 ? (
            <p className="text-gray-500 text-sm">예정된 교육이 없습니다.</p>
        ) : (
            <div className="space-y-4">
            {eventGroups.map((group, i) => (
                <div key={i} className="border rounded-lg overflow-hidden">
                {/* 교육 타이틀 */}
                <div className="p-3 bg-gray-100 flex justify-between items-center">
                    <span className="font-bold">{group.templateName}</span>
                    <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
                    엑셀 다운로드
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                        <th className="px-3 py-2 text-left">교육일</th>
                        <th className="px-3 py-2 text-left">교육장</th>
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
                        const event = group.events.find(e => e.event.id === member.eventId)?.event
                        
                        // 오늘/내일 음영
                        const eventDate = new Date(member.eventDate)
                        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
                        const diffTime = eventDateOnly.getTime() - today.getTime()
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        
                        let rowBgClass = ''
                        if (diffDays === 0) {
                            rowBgClass = 'bg-red-50'  // 오늘
                        } else if (diffDays === 1) {
                            rowBgClass = 'bg-yellow-50'  // 내일
                        }
                        
                        return (
                            <tr key={j} className={`border-t ${rowBgClass}`}>
                            {/* 교육일 */}
                            <td className="px-3 py-2 font-medium">{formatDate(member.eventDate)}</td>
                            
                            {/* 교육장 */}
                            <td className="px-3 py-2 text-sm text-gray-600">
                                {event?.meeting_id && (
                                <div>ID: {event.meeting_id}</div>
                                )}
                                {event?.location_detail && !event?.meeting_id && (
                                <div>{event.location_detail}</div>
                                )}
                                {!event?.meeting_id && !event?.location_detail && '-'}
                            </td>
                            
                            {/* SR */}
                            <td className="px-3 py-2 text-gray-600">{member.sr_name}</td>
                            
                            {/* 지점 */}
                            <td className="px-3 py-2 text-gray-600">{member.branch_name}</td>
                            
                            {/* 직책 */}
                            <td className="px-3 py-2 text-gray-600">{member.position}</td>
                            
                            {/* 이름 */}
                            <td className="px-3 py-2 font-medium">{member.name}</td>
                            
                            {/* 변경 */}
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openChangeModal(member, event)}
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

              {/* 자체 교육 */}
                {customTrainings.length > 0 && (
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold">🎓 자체 교육</h3>
                    </div>
                    
                    <div className="space-y-4">
                    {customTrainings.map((training, i) => {
                        const isPassed = new Date(training.event.event_date) < today
                        
                        return (
                        <div key={i} className="border rounded-lg overflow-hidden">
                            {/* 교육 타이틀 */}
                            <div className="p-3 bg-purple-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{training.event.title}</span>
                                <span className="text-sm text-gray-600">{formatDate(training.event.event_date)}</span>
                                {isPassed && (
                                <span className="px-2 py-1 rounded text-xs bg-gray-500 text-white">종료</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
                                엑셀 다운로드
                                </button>
                                <button className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-xs">
                                수정
                                </button>
                                <button className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs">
                                삭제
                                </button>
                            </div>
                            </div>
                            
                            {training.attendees.length === 0 ? (
                            <div className="p-4 text-gray-500 text-sm">배정된 인원이 없습니다.</div>
                            ) : (
                            <>
                                <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left">교육일</th>
                                        <th className="px-3 py-2 text-left">교육장</th>
                                        <th className="px-3 py-2 text-left">SR</th>
                                        <th className="px-3 py-2 text-left">지점</th>
                                        <th className="px-3 py-2 text-left">직책</th>
                                        <th className="px-3 py-2 text-left">이름</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {training.attendees.map((member, j) => {
                                        const eventDate = new Date(member.eventDate)
                                        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
                                        const diffTime = eventDateOnly.getTime() - today.getTime()
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                        
                                        let rowBgClass = ''
                                        if (diffDays === 0) {
                                        rowBgClass = 'bg-red-50'
                                        } else if (diffDays === 1) {
                                        rowBgClass = 'bg-yellow-50'
                                        }
                                        
                                        return (
                                        <tr key={j} className={`border-t ${rowBgClass}`}>
                                            <td className="px-3 py-2 font-medium">{formatDate(member.eventDate)}</td>
                                            <td className="px-3 py-2 text-sm text-gray-600">
                                            {training.event.meeting_id && (
                                                <div>ID: {training.event.meeting_id}</div>
                                            )}
                                            {training.event.location_detail && !training.event.meeting_id && (
                                                <div>{training.event.location_detail}</div>
                                            )}
                                            {!training.event.meeting_id && !training.event.location_detail && '-'}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">{member.sr_name}</td>
                                            <td className="px-3 py-2 text-gray-600">{member.branch_name}</td>
                                            <td className="px-3 py-2 text-gray-600">{member.position}</td>
                                            <td className="px-3 py-2 font-medium">{member.name}</td>
                                        </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                                </div>
                                <div className="p-2 bg-gray-50 text-xs text-gray-500">
                                총 {training.attendees.length}명
                                {training.event.memo && (
                                    <span className="ml-3 text-gray-600">메모: {training.event.memo}</span>
                                )}
                                </div>
                            </>
                            )}
                        </div>
                        )
                    })}
                    </div>
                </div>
                )}

        {/* 일일화상교육 현황 */}
        <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
            <h3 className="font-bold">📺 일일화상교육 현황</h3>
            {dailyVideoTab === 'team' && dailyVideoStatus.length > 0 && (
                <span className="text-sm font-semibold text-blue-600">
                이수율: {Math.round((dailyVideoStatus.filter(m => m.isCompleted).length / dailyVideoStatus.length) * 100)}%
                </span>
            )}
            {dailyVideoTab === 'my' && myDailyVideos.length > 0 && (
                <span className="text-sm font-semibold text-blue-600">
                이수율: {Math.round((myDailyVideos.filter(v => v.is_completed).length / myDailyVideos.length) * 100)}%
                </span>
            )}
            </div>
            <div className="flex items-center gap-2">
            {dailyVideoDeadline && (
                <span className="text-sm text-gray-500">마감: {formatDate(dailyVideoDeadline)}</span>
            )}
            <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs">
                엑셀 ↓
            </button>
            </div>
        </div>

        {/* 탭 버튼 */}
        <div className="flex gap-2 mb-4 border-b">
            <button
            onClick={() => setDailyVideoTab('my')}
            className={`px-4 py-2 font-medium transition-colors ${
                dailyVideoTab === 'my'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            >
            내 이수현황 (SR용)
            </button>
            <button
            onClick={() => setDailyVideoTab('team')}
            className={`px-4 py-2 font-medium transition-colors ${
                dailyVideoTab === 'team'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            >
            담당 매니저 (매니저용)
            </button>
        </div>

        {/* 내 이수현황 탭 */}
        {dailyVideoTab === 'my' && (
            <>
            {myDailyVideos.length === 0 ? (
                <p className="text-gray-500 text-sm">이번 달 등록된 SR용 영상이 없습니다.</p>
            ) : (
                <>
                <div className="overflow-x-auto mb-3">
                    <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                        <th className="px-3 py-2 text-left">영상명</th>
                        <th className="px-3 py-2 text-center">상태</th>
                        <th className="px-3 py-2 text-center">이수일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {myDailyVideos.map((video, i) => (
                        <tr key={i} className="border-t">
                            <td className="px-3 py-2">{video.video_name}</td>
                            <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${video.is_completed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {video.is_completed ? '이수' : '미이수'}
                            </span>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-600">
                            {video.completion_date ? formatDate(video.completion_date) : '-'}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                <div className="text-xs text-gray-500">
                    이수: {myDailyVideos.filter(v => v.is_completed).length}개 / 총 {myDailyVideos.length}개
                </div>
                </>
            )}
            </>
        )}

        {/* 담당 매니저 탭 */}
        {dailyVideoTab === 'team' && (
            <>
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
    
    {/* 교육 추가 모달 */}
      {showAddTrainingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
            <h3 className="font-bold text-lg mb-4">➕ 자체 교육 추가</h3>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 교육명 */}
              <div>
                <label className="block text-sm font-medium mb-1">교육명 *</label>
                <input
                  type="text"
                  value={newTraining.title}
                  onChange={(e) => setNewTraining({...newTraining, title: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="예: 신제품 교육"
                />
              </div>

              {/* 교육일 */}
              <div>
                <label className="block text-sm font-medium mb-1">교육일 *</label>
                <input
                  type="date"
                  value={newTraining.event_date}
                  onChange={(e) => setNewTraining({...newTraining, event_date: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* 시간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={newTraining.start_time}
                    onChange={(e) => setNewTraining({...newTraining, start_time: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={newTraining.end_time}
                    onChange={(e) => setNewTraining({...newTraining, end_time: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* 장소 유형 */}
              <div>
                <label className="block text-sm font-medium mb-2">장소</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="ZOOM"
                      checked={newTraining.location_type === 'ZOOM'}
                      onChange={(e) => setNewTraining({...newTraining, location_type: e.target.value})}
                    />
                    <span>ZOOM</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="OFFLINE"
                      checked={newTraining.location_type === 'OFFLINE'}
                      onChange={(e) => setNewTraining({...newTraining, location_type: e.target.value})}
                    />
                    <span>오프라인</span>
                  </label>
                </div>
              </div>

              {/* ZOOM 정보 */}
              {newTraining.location_type === 'ZOOM' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">회의 ID</label>
                    <input
                      type="text"
                      value={newTraining.meeting_id}
                      onChange={(e) => setNewTraining({...newTraining, meeting_id: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="123 456 789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">비밀번호</label>
                    <input
                      type="text"
                      value={newTraining.meeting_password}
                      onChange={(e) => setNewTraining({...newTraining, meeting_password: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="0000"
                    />
                  </div>
                </div>
              )}

              {/* 오프라인 장소 */}
              {newTraining.location_type === 'OFFLINE' && (
                <div>
                  <label className="block text-sm font-medium mb-1">교육장</label>
                  <input
                    type="text"
                    value={newTraining.location_detail}
                    onChange={(e) => setNewTraining({...newTraining, location_detail: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="서울교육장"
                  />
                </div>
              )}

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <textarea
                  value={newTraining.memo}
                  onChange={(e) => setNewTraining({...newTraining, memo: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                  placeholder="추가 설명이나 준비물 등"
                />
              </div>

              {/* 대상자 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  대상자 선택 ({newTraining.selected_members.length}명 선택)
                </label>
                <div className="border rounded p-3 max-h-60 overflow-y-auto">
                  <label className="flex items-center gap-2 mb-2 pb-2 border-b font-medium">
                    <input
                      type="checkbox"
                      checked={newTraining.selected_members.length === teamMembers.length}
                      onChange={toggleAllMembers}
                    />
                    <span>전체 선택 ({teamMembers.length}명)</span>
                  </label>
                  <div className="space-y-1">
                    {teamMembers.map(member => (
                      <label key={member.id} className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={newTraining.selected_members.includes(member.id)}
                          onChange={() => toggleMemberSelection(member.id)}
                        />
                        <span className="text-sm">
                          {member.sr_name} - {member.branch_name} - {member.position} - {member.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddTraining}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setShowAddTrainingModal(false)
                  setNewTraining({
                    title: '',
                    event_date: '',
                    start_time: '',
                    end_time: '',
                    location_type: 'ZOOM',
                    meeting_id: '',
                    meeting_password: '0000',
                    location_detail: '',
                    memo: '',
                    selected_members: []
                  })
                }}
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