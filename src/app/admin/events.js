'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function EventManagement() {
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  
  const [formData, setFormData] = useState({
    template_id: '',
    title: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location: '',
    online_link: '',
    deadline_date: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // 템플릿 로드
    const { data: templateData } = await supabase
      .from('training_templates')
      .select('*')
      .order('name')
    if (templateData) setTemplates(templateData)

    // 이벤트 로드
    const { data: eventData } = await supabase
      .from('training_events')
      .select('*, training_templates(*)')
      .order('event_date', { ascending: false })
    if (eventData) setEvents(eventData)

    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.template_id || !formData.event_date) {
      setMessage('교육 종류와 날짜를 선택해주세요.')
      return
    }

    const { error } = await supabase
      .from('training_events')
      .insert({
        template_id: formData.template_id,
        title: formData.title || null,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location || null,
        online_link: formData.online_link || null,
        deadline_date: formData.deadline_date || null,
        status: 'PUBLISHED'
      })

    if (error) {
      setMessage('등록 실패: ' + error.message)
    } else {
      setMessage('교육 일정이 등록되었습니다!')
      setShowForm(false)
      setFormData({
        template_id: '',
        title: '',
        event_date: '',
        start_time: '',
        end_time: '',
        location: '',
        online_link: '',
        deadline_date: ''
      })
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
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📅 교육 일정 관리</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          {showForm ? '취소' : '+ 새 교육 등록'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('실패') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {/* 등록 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">교육 종류 *</label>
              <select
                value={formData.template_id}
                onChange={(e) => setFormData({...formData, template_id: e.target.value})}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">선택하세요</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">교육명 (선택)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="예: 1월 역량강화교육 1차"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">교육 날짜 *</label>
              <input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({...formData, event_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">변경 마감일</label>
              <input
                type="date"
                value={formData.deadline_date}
                onChange={(e) => setFormData({...formData, deadline_date: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">시작 시간</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">종료 시간</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">장소</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                placeholder="예: ZOOM, 본사 3층"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">온라인 링크</label>
              <input
                type="text"
                value={formData.online_link}
                onChange={(e) => setFormData({...formData, online_link: e.target.value})}
                placeholder="https://..."
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            등록하기
          </button>
        </form>
      )}

      {/* 교육 목록 */}
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-left">교육 종류</th>
                <th className="px-3 py-2 text-left">교육명</th>
                <th className="px-3 py-2 text-left">시간</th>
                <th className="px-3 py-2 text-left">장소</th>
                <th className="px-3 py-2 text-left">관리</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{formatDate(event.event_date)}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {event.training_templates?.name || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2">{event.title || '-'}</td>
                  <td className="px-3 py-2">
                    {event.start_time ? `${event.start_time?.slice(0,5)}~${event.end_time?.slice(0,5)}` : '-'}
                  </td>
                  <td className="px-3 py-2">{event.location || '-'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
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