'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function RequestManagement() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('PENDING')

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    
    // 1. 먼저 기본 데이터만 조회
    const { data: requests, error } = await supabase
      .from('change_requests')
      .select('*')
      .order('requested_at', { ascending: false })
    
    if (error) {
      console.error('변경 요청 로드 실패:', error)
      setLoading(false)
      returng
    }

    if (!requests || requests.length === 0) {
      console.log('변경 요청 없음')
      setRequests([])
      setLoading(false)
      return
    }

    console.log('✅ 로드된 변경 요청:', requests)

    // 2. 추가 정보 조회
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        // 사용자 정보
        const { data: user } = await supabase
          .from('users')
          .select('name, employee_id, branch_name')
          .eq('id', req.user_id)
          .single()

        // 요청자 정보
        const { data: requester } = await supabase
          .from('users')
          .select('name')
          .eq('id', req.requested_by)
          .single()

        // 원래 교육 정보
        const { data: originalEvent } = await supabase
          .from('training_events')
          .select('event_date, start_time, template_id')
          .eq('id', req.original_event_id)
          .single()

        // 원래 교육의 템플릿 정보
        let originalTemplate = null
        if (originalEvent?.template_id) {
          const { data: template } = await supabase
            .from('training_templates')
            .select('name')
            .eq('id', originalEvent.template_id)
            .single()
          originalTemplate = template
        }

        // 변경 요청 교육 정보
        const { data: requestedEvent } = await supabase
          .from('training_events')
          .select('event_date, start_time')
          .eq('id', req.requested_event_id)
          .single()

        return {
          ...req,
          user,
          requester,
          original_event: originalEvent ? {
            ...originalEvent,
            training_templates: originalTemplate
          } : null,
          requested_event: requestedEvent
        }
      })
    )

    console.log('✅ 상세 정보 포함:', enrichedRequests)
    setRequests(enrichedRequests)
    setLoading(false)
  }

  const handleApprove = async (requestId) => {
    // 1. 요청 정보 조회
    const request = requests.find(r => r.id === requestId)
    if (!request) {
      setMessage('❌ 요청을 찾을 수 없습니다.')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // 2. 기존 배정 삭제
    const { error: deleteError } = await supabase
      .from('training_assignments')
      .delete()
      .eq('user_id', request.user_id)
      .eq('event_id', request.original_event_id)

    if (deleteError) {
      setMessage('❌ 기존 배정 삭제 실패: ' + deleteError.message)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // 3. 새 배정 추가
    const { error: insertError } = await supabase
      .from('training_assignments')
      .insert({
        user_id: request.user_id,
        event_id: request.requested_event_id
      })

    if (insertError) {
      setMessage('❌ 새 배정 추가 실패: ' + insertError.message)
      setTimeout(() => setMessage(''), 3000)
      return
    }

    // 4. 변경 요청 상태 업데이트
    const { error: updateError } = await supabase
      .from('change_requests')
      .update({ 
        status: 'APPROVED',
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (updateError) {
      setMessage('❌ 상태 업데이트 실패: ' + updateError.message)
    } else {
      setMessage('✅ 승인 완료! 교육 일정이 변경되었습니다.')
      loadRequests()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleReject = async (requestId) => {
    const reason = prompt('반려 사유를 입력하세요:')
    if (reason === null) return

    const { error } = await supabase
      .from('change_requests')
      .update({ 
        status: 'REJECTED',
        reject_reason: reason,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    if (error) {
      setMessage('반려 실패: ' + error.message)
    } else {
      setMessage('반려되었습니다.')
      loadRequests()
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const filteredRequests = requests.filter(r => {
    if (filter === 'ALL') return true
    if (filter === 'PROCESSED') return r.status === 'APPROVED' || r.status === 'REJECTED'
    return r.status === filter
  })
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">대기중</span>
      case 'APPROVED':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">승인</span>
      case 'REJECTED':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">반려</span>
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">{status}</span>
    }
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  return (
    <div className="bg-white rounded-lg shadow p-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">📋 변경 요청 관리</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </div>
        
        {/* 통계 표시 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">대기:</span>
            <span className="font-bold text-yellow-600">{requests.filter(r => r.status === 'PENDING').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">승인:</span>
            <span className="font-bold text-green-600">{requests.filter(r => r.status === 'APPROVED').length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">반려:</span>
            <span className="font-bold text-red-600">{requests.filter(r => r.status === 'REJECTED').length}</span>
          </div>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-1 text-sm"
        >
          <option value="PENDING">대기중</option>
          <option value="PROCESSED">처리 완료</option>
          <option value="ALL">전체</option>
        </select>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('실패') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <p>로딩 중...</p>
      ) : filteredRequests.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {filter === 'PENDING' ? '대기중인 요청이 없습니다.' : '요청 내역이 없습니다.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div key={req.id} className={`border rounded-lg p-4 ${req.status === 'PENDING' ? 'border-yellow-300 bg-yellow-50' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold">{req.user?.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({req.user?.branch_name})</span>
                </div>
                {getStatusBadge(req.status)}
              </div>
              
              <div className="text-sm space-y-1 mb-3">
                <p>
                  <span className="text-gray-500">교육:</span>{' '}
                  <span className="font-medium">{req.original_event?.training_templates?.name}</span>
                </p>
                <p>
                  <span className="text-gray-500">변경:</span>{' '}
                  <span className="text-red-500 line-through">{formatDate(req.original_event?.event_date)}</span>
                  {' → '}
                  <span className="text-green-600 font-medium">{formatDate(req.requested_event?.event_date)}</span>
                </p>
                {req.reason && (
                  <p>
                    <span className="text-gray-500">사유:</span> {req.reason}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  요청자: {req.requester?.name} | 요청일: {formatDateTime(req.requested_at)}
                  {req.processed_at && (
                    <span className="ml-2">
                      | 처리일: {formatDateTime(req.processed_at)}
                    </span>
                  )}
                </p>
                {req.status === 'REJECTED' && req.reject_reason && (
                  <p className="text-red-600 text-xs">
                    반려 사유: {req.reject_reason}
                  </p>
                )}
              </div>

            {req.status === 'PENDING' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req.id)}
                  className="w-20 bg-green-600 text-white py-1.5 rounded hover:bg-green-700 text-sm"
                >
                  승인
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  className="w-20 bg-red-600 text-white py-1.5 rounded hover:bg-red-700 text-sm"
                >
                  반려
                </button>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}