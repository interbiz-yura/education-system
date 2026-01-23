'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function EventManagement() {
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    const { data: templateData } = await supabase
      .from('training_templates')
      .select('*')
      .order('name')
    if (templateData) setTemplates(templateData)

    const { data: eventData } = await supabase
      .from('training_events')
      .select(`
        *,
        training_templates(name),
        training_event_dates(id, capacity)
      `)
      .order('event_date', { ascending: false })

    if (eventData) {
      const enriched = await Promise.all(
        eventData.map(async (event) => {
          let deptQuotas = []
          if (event.training_event_dates && event.training_event_dates.length > 0) {
            const dateId = event.training_event_dates[0].id
            const { data: quotas } = await supabase
              .from('training_date_department_quotas')
              .select('*')
              .eq('event_date_id', dateId)
            deptQuotas = quotas || []
          }
          return { ...event, deptQuotas }
        })
      )
      setEvents(enriched)
    }

    setLoading(false)
  }

  const handleEdit = (event) => {
    setEditingId(event.id)
    setEditForm({
      template_id: event.template_id,
      title: event.title || '',
      event_date: event.event_date || '',
      start_time: event.start_time || '',
      end_time: event.end_time || '',
      location_type: event.location_type || 'ZOOM',
      meeting_id: event.meeting_id || '',
      meeting_password: event.meeting_password || '',
      location_detail: event.location_detail || '',
      capacity: event.training_event_dates?.[0]?.capacity || '',
      target_mode: event.target_mode || 'ALL',
      target_departments: event.target_departments || [],
      assignment_mode: event.assignment_mode || 'DIRECT'
    })
  }

  const handleUpdate = async (eventId) => {
    if (!editForm.template_id || !editForm.event_date) {
      setMessage('필수 항목을 입력해주세요.')
      return
    }

    const updateData = {
      template_id: editForm.template_id,
      title: editForm.title,
      event_date: editForm.event_date,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      location_type: editForm.location_type,
      target_mode: editForm.target_mode,
      assignment_mode: editForm.assignment_mode
    }

    if (editForm.location_type === 'ZOOM') {
      updateData.meeting_id = editForm.meeting_id
      updateData.meeting_password = editForm.meeting_password
      updateData.location_detail = null
    } else {
      updateData.location_detail = editForm.location_detail
      updateData.meeting_id = null
      updateData.meeting_password = null
    }

    if (editForm.target_mode === 'DEPARTMENT' && editForm.target_departments.length > 0) {
      updateData.target_departments = editForm.target_departments
    } else {
      updateData.target_departments = null
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '' || updateData[key] === null) {
        delete updateData[key]
      }
    })

    const { error } = await supabase
      .from('training_events')
      .update(updateData)
      .eq('id', eventId)

    if (error) {
      setMessage('수정 실패: ' + error.message)
    } else {
      if (editForm.capacity) {
        const event = events.find(e => e.id === eventId)
        if (event.training_event_dates && event.training_event_dates.length > 0) {
          await supabase
            .from('training_event_dates')
            .update({ capacity: parseInt(editForm.capacity) })
            .eq('event_id', eventId)
        } else {
          await supabase
            .from('training_event_dates')
            .insert({
              event_id: eventId,
              event_date: editForm.event_date,
              start_time: editForm.start_time,
              end_time: editForm.end_time,
              capacity: parseInt(editForm.capacity)
            })
        }
      }

      setMessage('수정되었습니다!')
      setEditingId(null)
      setEditForm(null)
      loadData()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDelete = async (eventId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('training_events')
      .delete()
      .eq('id', eventId)

    if (error) {
      setMessage('삭제 실패: ' + error.message)
    } else {
      setMessage('삭제되었습니다.')
      loadData()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return dateStr
  }

  const getAssignmentModeText = (mode) => {
    return mode === 'DRAFT' ? '배정 대기' : mode === 'DIRECT' ? '즉시 배정' : '확정'
  }

  const getLocationText = (event) => {
    if (event.location_type === 'ZOOM') {
      return `ZOOM ${event.meeting_id || ''}`
    } else if (event.location_type === 'OFFLINE') {
      return event.location_detail || '-'
    }
    return event.location || '-'
  }

  const getTargetText = (event) => {
    if (event.target_mode === 'ALL') return '전체'
    if (event.target_mode === 'DEPARTMENT') {
      return event.target_departments?.join(', ') || '특정 담당'
    }
    if (event.target_mode === 'CUSTOM') return '엑셀 업로드'
    return '-'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📅 교육 목록</h2>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('실패') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2">교육명</th>
                <th className="border px-2 py-2">템플릿</th>
                <th className="border px-2 py-2">날짜</th>
                <th className="border px-2 py-2">시간</th>
                <th className="border px-2 py-2">교육장</th>
                <th className="border px-2 py-2">정원</th>
                <th className="border px-2 py-2">담당별TO</th>
                <th className="border px-2 py-2">대상</th>
                <th className="border px-2 py-2">배정방식</th>
                <th className="border px-2 py-2">관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                editingId === event.id ? (
                  <tr key={event.id} className="bg-blue-50">
                    <td className="border px-2 py-2">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                        placeholder="교육명"
                      />
                    </td>
                    <td className="border px-2 py-2">
                      <select
                        value={editForm.template_id}
                        onChange={(e) => setEditForm({...editForm, template_id: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                      >
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-2">
                      <input
                        type="date"
                        value={editForm.event_date}
                        onChange={(e) => setEditForm({...editForm, event_date: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </td>
                    <td className="border px-2 py-2">
                      <input
                        type="time"
                        value={editForm.start_time}
                        onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs mb-1"
                      />
                      <input
                        type="time"
                        value={editForm.end_time}
                        onChange={(e) => setEditForm({...editForm, end_time: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </td>
                    <td className="border px-2 py-2">
                      <select
                        value={editForm.location_type}
                        onChange={(e) => setEditForm({...editForm, location_type: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs mb-1"
                      >
                        <option value="ZOOM">ZOOM</option>
                        <option value="OFFLINE">오프라인</option>
                      </select>
                      {editForm.location_type === 'ZOOM' ? (
                        <input
                          type="text"
                          value={editForm.meeting_id}
                          onChange={(e) => setEditForm({...editForm, meeting_id: e.target.value})}
                          placeholder="회의 ID"
                          className="w-full px-2 py-1 border rounded text-xs"
                        />
                      ) : (
                        <input
                          type="text"
                          value={editForm.location_detail}
                          onChange={(e) => setEditForm({...editForm, location_detail: e.target.value})}
                          placeholder="주소"
                          className="w-full px-2 py-1 border rounded text-xs"
                        />
                      )}
                    </td>
                    <td className="border px-2 py-2">
                      <input
                        type="number"
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({...editForm, capacity: e.target.value})}
                        placeholder="정원"
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </td>
                    <td className="border px-2 py-2 text-gray-500">수정불가</td>
                    <td className="border px-2 py-2">
                      <select
                        value={editForm.target_mode}
                        onChange={(e) => setEditForm({...editForm, target_mode: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                      >
                        <option value="ALL">전체</option>
                        <option value="DEPARTMENT">특정담당</option>
                        <option value="CUSTOM">엑셀업로드</option>
                      </select>
                    </td>
                    <td className="border px-2 py-2">
                      <select
                        value={editForm.assignment_mode}
                        onChange={(e) => setEditForm({...editForm, assignment_mode: e.target.value})}
                        className="w-full px-2 py-1 border rounded text-xs"
                      >
                        <option value="DIRECT">즉시배정</option>
                        <option value="DRAFT">배정대기</option>
                      </select>
                    </td>
                    <td className="border px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleUpdate(event.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditForm(null)
                          }}
                          className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                        >
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="border px-2 py-2">{event.title || '-'}</td>
                    <td className="border px-2 py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {event.training_templates?.name || '-'}
                      </span>
                    </td>
                    <td className="border px-2 py-2">{formatDate(event.event_date)}</td>
                    <td className="border px-2 py-2">
                      {event.start_time && event.end_time
                        ? `${event.start_time.slice(0,5)}~${event.end_time.slice(0,5)}`
                        : '-'}
                    </td>
                    <td className="border px-2 py-2">{getLocationText(event)}</td>
                    <td className="border px-2 py-2">
                      {event.training_event_dates?.[0]?.capacity || '무제한'}
                    </td>
                    <td className="border px-2 py-2">
                      {event.deptQuotas && event.deptQuotas.length > 0 ? (
                        <div className="text-xs">
                          {event.deptQuotas.map(q => (
                            <div key={q.id}>{q.department}:{q.quota}</div>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="border px-2 py-2">{getTargetText(event)}</td>
                    <td className="border px-2 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.assignment_mode === 'DRAFT' 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {getAssignmentModeText(event.assignment_mode)}
                      </span>
                    </td>
                    <td className="border px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleEdit(event)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          
          {events.length === 0 && (
            <p className="text-center py-4 text-gray-500">등록된 교육이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}