'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function TrainingAssignments() {
  const [user, setUser] = useState(null)
  const [templates, setTemplates] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [deptQuotas, setDeptQuotas] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth()
    loadTemplates()
    generatePeriods()
  }, [])

  const checkAuth = () => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('training_templates')
      .select('*')
      .order('name')
    
    if (data) setTemplates(data)
  }

  const generatePeriods = () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedPeriod(currentMonth)
    
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    setStartDate(`${year}-${String(month).padStart(2, '0')}-01`)
    
    const lastDay = new Date(year, month, 0).getDate()
    setEndDate(`${year}-${String(month).padStart(2, '0')}-${lastDay}`)
  }

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period)
    const [year, month] = period.split('-')
    setStartDate(`${year}-${month}-01`)
    
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    setEndDate(`${year}-${month}-${lastDay}`)
  }

  const loadEvents = async () => {
    if (!selectedTemplate || !startDate || !endDate) return

    setLoading(true)
    const { data, error } = await supabase
      .from('training_events')
      .select('*')
      .eq('template_id', selectedTemplate)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date')

    if (data) {
      const eventsWithCounts = await Promise.all(
        data.map(async (event) => {
          const { count: totalCount } = await supabase
            .from('training_target_pool')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)

          const { count: assignedCount } = await supabase
            .from('training_target_pool')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('status', 'ASSIGNED')

          const { count: excludedCount } = await supabase
            .from('training_target_pool')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('status', 'EXCLUDED')

          return {
            ...event,
            totalCount: totalCount || 0,
            assignedCount: assignedCount || 0,
            excludedCount: excludedCount || 0
          }
        })
      )
      setEvents(eventsWithCounts)
    }
    setLoading(false)
  }

  const loadAssignments = async (eventId) => {
    setSelectedEvent(eventId)
    setLoading(true)

    const { data, error } = await supabase
      .from('training_target_pool')
      .select(`
        *,
        users!training_target_pool_user_id_fkey (
          employee_id, name, department, sr_name, channel, branch_name, position, phone
        ),
        training_event_dates (event_date, start_time, end_time),
        excluded_by_user:users!training_target_pool_excluded_by_fkey (name)
      `)
      .eq('event_id', eventId)
      .order('status')

    if (data) {
      const event = events.find(e => e.id === eventId)
      const enriched = data.map(item => ({
        ...item,
        event_date: item.training_event_dates?.event_date || event?.event_date,
        start_time: item.training_event_dates?.start_time || event?.start_time,
        location_detail: event?.location_detail,
        meeting_id: event?.meeting_id,
        location_type: event?.location_type
      }))

      enriched.sort((a, b) => {
        if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date)
        const locA = a.location_detail || a.meeting_id || ''
        const locB = b.location_detail || b.meeting_id || ''
        if (locA !== locB) return locA.localeCompare(locB)
        if (a.users.department !== b.users.department) return a.users.department.localeCompare(b.users.department)
        if (a.users.sr_name !== b.users.sr_name) return a.users.sr_name.localeCompare(b.users.sr_name)
        if (a.users.branch_name !== b.users.branch_name) return a.users.branch_name.localeCompare(b.users.branch_name)
        return a.users.name.localeCompare(b.users.name)
      })

      setAssignments(enriched)
    }

    await loadDeptQuotas(eventId)
    setLoading(false)
  }

    const loadDeptQuotas = async (eventId) => {
    const { data: dateData, error } = await supabase
        .from('training_event_dates')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle() // ⭐ single() → maybeSingle()

    if (error) {
        console.log('날짜 데이터 없음:', error)
        setDeptQuotas([])
        return
    }

    if (dateData) {
      const { data: quotas } = await supabase
        .from('training_date_department_quotas')
        .select('*')
        .eq('event_date_id', dateData.id)

      setDeptQuotas(quotas || [])
    } else {
      setDeptQuotas([])
    }
  }

  const handleApprove = async (ids) => {
    if (ids.length === 0) {
      alert('승인할 항목을 선택해주세요.')
      return
    }

    if (!confirm(`${ids.length}명을 승인하시겠습니까?`)) return

    setLoading(true)

    try {
      const approveItems = assignments.filter(a => ids.includes(a.id) && a.status === 'ASSIGNED')

      const dateGroups = {}
      approveItems.forEach(item => {
        const key = item.event_date
        if (!dateGroups[key]) {
          dateGroups[key] = {
            date: item.event_date,
            time: { start: item.start_time, end: item.end_time },
            location: item.location_detail || item.meeting_id,
            type: item.location_type,
            users: []
          }
        }
        dateGroups[key].users.push(item)
      })

      const event = events.find(e => e.id === selectedEvent)

      for (const [dateKey, group] of Object.entries(dateGroups)) {
        const { data: newEvent, error: eventError } = await supabase
          .from('training_events')
          .insert({
            title: event.title,
            template_id: event.template_id,
            event_date: group.date,
            start_time: group.time.start,
            end_time: group.time.end,
            meeting_id: group.type === 'ZOOM' ? group.location : null,
            meeting_password: event.meeting_password,
            location_detail: group.type === 'OFFLINE' ? group.location : null,
            location_type: group.type,
            status: 'PUBLISHED',
            assignment_mode: 'CONFIRMED',
            created_by: user.id
          })
          .select()
          .single()

        if (eventError) throw eventError

        const finalAssignments = group.users.map(item => ({
          user_id: item.user_id,
          event_id: newEvent.id,
          status: 'ASSIGNED'
        }))

        await supabase
          .from('training_assignments')
          .insert(finalAssignments)

        const poolIds = group.users.map(item => item.id)
        await supabase
          .from('training_target_pool')
          .update({ status: 'CONFIRMED' })
          .in('id', poolIds)
      }

      alert('✅ 승인 완료!')
      loadAssignments(selectedEvent)
      loadEvents()
    } catch (error) {
      console.error('승인 오류:', error)
      alert('승인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setSelectedIds([])
    }
  }

  const handleStatusChange = async (poolId, newStatus, reason = null) => {
    const updates = { status: newStatus }
    
    if (newStatus === 'EXCLUDED') {
      updates.exclude_reason = reason
      updates.excluded_at = new Date().toISOString()
      updates.excluded_by = user.id
    } else if (newStatus === 'AVAILABLE') {
      updates.exclude_reason = null
      updates.excluded_at = null
      updates.excluded_by = null
    }

    const { error } = await supabase
      .from('training_target_pool')
      .update(updates)
      .eq('id', poolId)

    if (!error) {
      loadAssignments(selectedEvent)
    }
  }

  const handleExcelDownload = () => {
    const filtered = getFilteredAssignments()
    const excelData = filtered
      .filter(a => a.status !== 'EXCLUDED')
      .map(item => ({
        '교육일': item.event_date || '',
        '교육장': item.location_type === 'ZOOM' ? `ZOOM ${item.meeting_id}` : item.location_detail,
        '담당': item.users.department || '',
        'SR': item.users.sr_name || '',
        '채널': item.users.channel || '',
        '지점명': item.users.branch_name || '',
        '사번': item.users.employee_id || '',
        '직책': item.users.position || '',
        '이름': item.users.name || '',
        '연락처': item.users.phone || ''
      }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '대상자')

    const eventTitle = events.find(e => e.id === selectedEvent)?.title || '교육'
    const fileName = `${eventTitle}_${new Date().toISOString().split('T')[0]}_대상자.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const getFilteredAssignments = () => {
    if (!searchTerm) return assignments
    
    return assignments.filter(a => 
      a.users.employee_id?.includes(searchTerm) ||
      a.users.name?.includes(searchTerm)
    )
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const filtered = getFilteredAssignments().filter(a => a.status === 'ASSIGNED')
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(a => a.id))
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">⏳ 배정대기</span>
      case 'CONFIRMED':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">✅ 배정완료</span>
      case 'EXCLUDED':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">🚫 제외</span>
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">미배정</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">🔍 교육 검색</h2>
        
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">기간 선택</label>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">교육 템플릿</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">선택하세요</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <button
          onClick={loadEvents}
          disabled={!selectedTemplate || loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          {loading ? '조회 중...' : '교육 조회'}
        </button>
      </div>

      {/* 교육 목록 */}
      {events.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📅 교육 목록</h2>
          <div className="space-y-2">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => loadAssignments(event.id)}
                className={`w-full text-left p-4 rounded-lg border ${
                  selectedEvent === event.id ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{event.title}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      {event.event_date} {event.start_time}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({event.assignment_mode === 'DRAFT' ? '배정 대기' : '즉시 배정'})
                    </span>
                  </div>
                  <div className="text-sm">
                    배정: {event.assignedCount}/{event.totalCount}
                    {event.excludedCount > 0 && (
                      <span className="text-gray-500 ml-2">(제외: {event.excludedCount})</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 담당별 TO 현황 */}
      {deptQuotas.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">📊 담당별 TO 현황</h2>
          <div className="grid grid-cols-4 gap-4">
            {deptQuotas.map(quota => (
              <div key={quota.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{quota.department}</div>
                <div className="text-sm text-gray-600">
                  {quota.current_count} / {quota.quota}명
                  {quota.current_count >= quota.quota && <span className="ml-2 text-green-600">✅</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대상자 리스트 */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">👥 대상자 리스트 ({assignments.length}명)</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="사번/이름 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              />
              <button
                onClick={() => handleApprove(selectedIds)}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
              >
                선택 승인 ({selectedIds.length})
              </button>
              <button
                onClick={() => {
                  const assignedIds = getFilteredAssignments()
                    .filter(a => a.status === 'ASSIGNED')
                    .map(a => a.id)
                  handleApprove(assignedIds)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                일괄 승인
              </button>
              <button
                onClick={handleExcelDownload}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                엑셀 다운로드
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === getFilteredAssignments().filter(a => a.status === 'ASSIGNED').length && selectedIds.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="border px-2 py-2">교육일</th>
                  <th className="border px-2 py-2">교육장</th>
                  <th className="border px-2 py-2">담당</th>
                  <th className="border px-2 py-2">SR</th>
                  <th className="border px-2 py-2">채널</th>
                  <th className="border px-2 py-2">지점명</th>
                  <th className="border px-2 py-2">사번</th>
                  <th className="border px-2 py-2">직책</th>
                  <th className="border px-2 py-2">이름</th>
                  <th className="border px-2 py-2">연락처</th>
                  <th className="border px-2 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredAssignments().map(item => (
                  <tr 
                    key={item.id}
                    className={item.status === 'EXCLUDED' ? 'bg-gray-100' : ''}
                  >
                    <td className="border px-2 py-2 text-center">
                      {item.status === 'ASSIGNED' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      )}
                    </td>
                    <td className="border px-2 py-2">{item.event_date || '-'}</td>
                    <td className="border px-2 py-2">
                      {item.location_type === 'ZOOM' ? `ZOOM ${item.meeting_id}` : item.location_detail}
                    </td>
                    <td className="border px-2 py-2">{item.users.department}</td>
                    <td className="border px-2 py-2">{item.users.sr_name}</td>
                    <td className="border px-2 py-2">{item.users.channel}</td>
                    <td className="border px-2 py-2">{item.users.branch_name}</td>
                    <td className="border px-2 py-2">{item.users.employee_id}</td>
                    <td className="border px-2 py-2">{item.users.position}</td>
                    <td className="border px-2 py-2">{item.users.name}</td>
                    <td className="border px-2 py-2">{item.users.phone}</td>
                    <td className="border px-2 py-2">
                      {item.status === 'EXCLUDED' ? (
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(item.status)}
                          <div className="text-xs text-gray-600">{item.exclude_reason}</div>
                          <div className="text-xs text-gray-500">
                            {item.excluded_by_user?.name}
                          </div>
                          <button
                            onClick={() => handleStatusChange(item.id, 'AVAILABLE')}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            제외 취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(item.status)}
                          {(item.status === 'AVAILABLE' || item.status === 'ASSIGNED') && (
                            <select
                              value=""
                              onChange={(e) => e.target.value && handleStatusChange(item.id, 'EXCLUDED', e.target.value)}
                              className="text-xs border rounded px-1 py-0.5"
                            >
                              <option value="">제외 처리</option>
                              <option value="다음교육예정">다음교육예정</option>
                              <option value="본부교육">본부교육</option>
                              <option value="휴직">휴직</option>
                              <option value="퇴사">퇴사</option>
                              <option value="기타">기타</option>
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}