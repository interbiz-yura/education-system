'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import UserManagement from './users'
import EventManagement from './events'
import ScoreManagement from './scores'
import HQEducationManagement from './hqeducation'
import RequestManagement from './requests'
import TrainingAssignments from './training-assignments'


export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncMode, setSyncMode] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [bulkPreview, setBulkPreview] = useState([])
  const [bulkMessage, setBulkMessage] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/')
      return
    }
    const parsed = JSON.parse(savedUser)
    if (parsed.role !== 'SUPER_ADMIN') {
      router.push('/dashboard')
      return
    }
    setUser(parsed)
  }, [])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setMessage('')
    setPreview([])

    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        setPreview(jsonData.slice(0, 5))
      }
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  const handleUploadUsers = async () => {
    if (!file) {
      setMessage('파일을 선택해주세요.')
      return
    }
    setLoading(true)
    setMessage('')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)

      let successCount = 0
      let errorCount = 0
      const errors = []
      const uploadedIds = []

      for (const row of jsonData) {
        const employeeId = String(row['ID'] || row['사번'] || '')
        
        const userData = {
          employee_id: employeeId,
          name: row['사원명'] || row['이름'] || '',
          birth_date: String(row['생년월일'] || '').replace(/[^0-9]/g, '').slice(0, 6),
          phone: String(row['핸드폰'] || row['연락처'] || ''),
          email: row['이메일'] || '',
          team: row['팀'] || '',
          department: row['담당'] || '',
          sr_name: row['SR'] || '',
          channel: row['채널'] || '',
          branch_name: row['지점명'] || row['지점'] || '',
          position: row['직책'] || '',
          role: row['권한'] || 'USER',
          status: 'ACTIVE',
          hire_date: row['입사일'] || null
        }

        if (!userData.employee_id || !userData.name) {
          errorCount++
          errors.push(`사번 또는 이름 누락: ${JSON.stringify(row)}`)
          continue
        }

        uploadedIds.push(employeeId)

        const { error } = await supabase
          .from('users')
          .upsert(userData, { onConflict: 'employee_id' })

        if (error) {
          errorCount++
          errors.push(`${userData.employee_id}: ${error.message}`)
        } else {
          successCount++
        }
      }

      // 동기화 모드: 엑셀에 없는 사람은 퇴사 처리
      if (syncMode && uploadedIds.length > 0) {
        const { data: allUsers } = await supabase
          .from('users')
          .select('employee_id')
          .eq('status', 'ACTIVE')

        if (allUsers) {
          const inactiveIds = allUsers
            .filter(u => !uploadedIds.includes(u.employee_id))
            .map(u => u.employee_id)

          if (inactiveIds.length > 0) {
            await supabase
              .from('users')
              .update({ status: 'INACTIVE' })
              .in('employee_id', inactiveIds)
            
            setMessage(`완료! 성공: ${successCount}건, 실패: ${errorCount}건, 퇴사처리: ${inactiveIds.length}건`)
          } else {
            setMessage(`완료! 성공: ${successCount}건, 실패: ${errorCount}건`)
          }
        }
      } else {
        setMessage(`완료! 성공: ${successCount}건, 실패: ${errorCount}건`)
      }

      if (errors.length > 0) {
        console.log('Errors:', errors)
      }
      setLoading(false)
      setFile(null)
      setPreview([])
    }
    reader.readAsArrayBuffer(file)
  }

  // 교육 일괄 등록 엑셀 업로드
  const handleBulkTrainingUpload = (e) => {
    const selectedFile = e.target.files[0]
    setBulkMessage('')
    setBulkPreview([])

    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        
        const preview = jsonData.slice(0, 5).map(row => ({
          title: row['교육명'] || '',
          template: row['템플릿명'] || '',
          date: row['날짜'] || '',
          time: `${row['시작시간'] || ''} - ${row['종료시간'] || ''}`,
          location_type: row['교육장타입'] || '',
          capacity: row['정원'] || '',
          target: row['대상'] || '전체'
        }))
        
        setBulkPreview(preview)
        setFile(selectedFile)
      }
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  // 교육 일괄 등록 실행
  const handleBulkTrainingSubmit = async () => {
    if (!file) {
      setBulkMessage('파일을 선택해주세요.')
      return
    }
    
    setBulkLoading(true)
    setBulkMessage('')

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet)

      let successCount = 0
      let errorCount = 0
      const errors = []

      const { data: templates } = await supabase
        .from('training_templates')
        .select('id, name')
      
      const templateMap = {}
      templates?.forEach(t => {
        templateMap[t.name] = t.id
      })

    for (const row of jsonData) {
      try {
        const title = row['교육명']
        const templateName = row['템플릿명']
        const eventDate = row['날짜']
        const startTime = row['시작시간']
        const endTime = row['종료시간']
        const locationType = row['교육장타입']
        const zoomId = row['ZOOM_ID'] || ''
        const zoomPw = row['ZOOM_PW'] || '0000'
        const address = row['주소'] || ''
        const capacity = row['정원'] || null
        const deptQuotasStr = row['담당별TO'] || ''
        const target = row['대상'] || '전체'

          if (!title || !templateName || !eventDate || !startTime || !endTime || !locationType) {
            errors.push(`${title || '(교육명없음)'}: 필수 항목 누락`)
            errorCount++
            continue
          }

          const templateId = templateMap[templateName]
          if (!templateId) {
            errors.push(`${title}: 템플릿 '${templateName}' 찾을 수 없음`)
            errorCount++
            continue
          }

          const eventData = {
            title,
            template_id: templateId,
            event_date: eventDate,
            start_time: startTime,
            end_time: endTime,
            assignment_mode: 'DIRECT',
            date_mode: 'SINGLE',
            target_mode: target === '전체' ? 'ALL' : 'DEPARTMENT',
            location_type: locationType,
            status: 'PUBLISHED',
            created_by: user.id
          }

          if (locationType === 'ZOOM') {
            eventData.meeting_id = zoomId
            eventData.meeting_password = zoomPw
          } else {
            eventData.location_detail = address
          }

          if (target !== '전체') {
            eventData.target_departments = target.split(',').map(d => d.trim())
          }

          const { data: newEvent, error: eventError } = await supabase
            .from('training_events')
            .insert([eventData])
            .select()
            .single()

          if (eventError) throw eventError

          // 정원 또는 담당별 TO가 있으면 training_event_dates 생성
          if (capacity || deptQuotasStr) {
            const { data: dateData, error: dateError } = await supabase
              .from('training_event_dates')
              .insert([{
                event_id: newEvent.id,
                event_date: eventDate,
                start_time: startTime,
                end_time: endTime,
                capacity: capacity ? parseInt(capacity) : null
              }])
              .select()
              .single()

            if (dateError) throw dateError

            // ⭐ 담당별 TO 파싱 및 저장
            if (deptQuotasStr && deptQuotasStr.trim() !== '') {
              // "영업1팀:5,영업2팀:3,영업3팀:10" 형식 파싱
              const quotaPairs = deptQuotasStr.split(',').map(s => s.trim()).filter(s => s)
              const quotaInserts = []

              for (const pair of quotaPairs) {
                const [dept, quotaStr] = pair.split(':').map(s => s.trim())
                const quota = parseInt(quotaStr)

                if (dept && !isNaN(quota) && quota > 0) {
                  quotaInserts.push({
                    event_date_id: dateData.id,
                    department: dept,
                    quota: quota
                  })
                }
              }

              if (quotaInserts.length > 0) {
                const { error: quotaError } = await supabase
                  .from('training_date_department_quotas')
                  .insert(quotaInserts)

                if (quotaError) {
                  console.error('담당별 TO 저장 오류:', quotaError)
                  errors.push(`${title}: 담당별 TO 저장 실패`)
                }
              }
            }
          }

          successCount++

        } catch (error) {
          errorCount++
          errors.push(`${row['교육명'] || '?'}: ${error.message}`)
        }
      }

      setBulkMessage(`완료! 성공: ${successCount}건, 실패: ${errorCount}건`)
      if (errors.length > 0) {
        console.log('일괄 등록 오류:', errors)
      }
      setBulkLoading(false)
      setBulkPreview([])
      setFile(null)
    }
    reader.readAsArrayBuffer(file)
  }
  if (!user) return <div className="min-h-screen flex items-center justify-center">로딩중...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-red-600 text-white p-4 shadow">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-bold">⚙️ 관리자 페이지</h1>
          <button onClick={() => router.push('/dashboard')} className="text-sm bg-red-700 px-3 py-1 rounded hover:bg-red-800">
            대시보드로
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* 탭 */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  👥 인원 관리
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'events' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  📅 교육 관리
                </button>
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'assignments' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  📋 인원별 교육일정
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  🔄 변경 요청
                </button>
                <button
                  onClick={() => setActiveTab('scores')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'scores' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  📊 점수 업로드
                </button>
                <button
                  onClick={() => setActiveTab('hqedu')}
                  className={`px-4 py-2 rounded text-sm ${activeTab === 'hqedu' ? 'bg-blue-600 text-white' : 'bg-white'}`}
                >
                  🎓 본부교육 이수현황
                </button>
              </div>

    
        {/* 인원 관리 */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* 인원 업로드 섹션 */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">📤 인원 엑셀 업로드</h2>
                
                <div className="mb-4 p-4 bg-gray-50 rounded text-sm">
                  <p className="font-semibold mb-2">엑셀 컬럼 형식:</p>
                  <p className="text-gray-600">팀 / 담당 / SR / 채널 / 지점명 / ID(사번) / 직책 / 사원명 / 근무상태 / 입사일 / 생년월일 / 핸드폰 / 이메일</p>
                </div>

                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />

                {preview.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <p className="text-sm font-semibold mb-2">미리보기 (상위 5행):</p>
                    <table className="min-w-full text-xs border">
                      <thead className="bg-gray-100">
                        <tr>
                          {Object.keys(preview[0]).map((key) => (
                            <th key={key} className="border px-2 py-1">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="border px-2 py-1">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="syncMode"
                    checked={syncMode}
                    onChange={(e) => setSyncMode(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="syncMode" className="text-sm">
                    <span className="font-semibold text-red-600">동기화 모드:</span> 엑셀에 없는 재직자는 자동 퇴사 처리
                  </label>
                </div>

                <button
                  onClick={handleUploadUsers}
                  disabled={loading || !file}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {loading ? '업로드 중...' : '업로드 및 적용'}
                </button>

                {message && (
                  <p className={`mt-4 font-semibold ${message.includes('실패') ? 'text-red-600' : 'text-green-600'}`}>
                    {message}
                  </p>
                )}
              </div>

              {/* 인원 리스트 섹션 */}
              <UserManagement />
            </div>
          )}

        {/* 교육 일정 */}
            {activeTab === 'events' && (
              <div className="space-y-6">
                {/* 교육 관리 버튼 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold mb-4">📅 교육 관리</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => router.push('/admin/training-setup')}
                      className="flex-1 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <div className="text-lg font-bold">📝 교육 등록</div>
                      <div className="text-sm opacity-90">단일 교육 등록 (담당별 TO 설정 가능)</div>
                    </button>
                    <button
                      onClick={() => setShowBulkUpload(!showBulkUpload)}
                      className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <div className="text-lg font-bold">📋 교육 일괄 등록</div>
                      <div className="text-sm opacity-90">엑셀로 여러 교육 한번에 등록</div>
                    </button>
                  </div>
                </div>

                {/* 교육 일괄 등록 섹션 (토글) */}
                {showBulkUpload && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">📋 교육 일괄 등록 (엑셀)</h2>
                    
                    <div className="mb-4 p-4 bg-gray-50 rounded text-sm">
                      <p className="font-semibold mb-2">엑셀 컬럼 형식 (순서 중요!):</p>
                      <p className="text-gray-600 text-xs mb-2">
                        교육명 | 템플릿명 | 날짜(YYYY-MM-DD) | 시작시간(HH:MM) | 종료시간(HH:MM) | 
                        교육장타입(ZOOM/OFFLINE) | ZOOM_ID | ZOOM_PW | 주소 | 정원 | 담당별TO | 대상(전체/담당명)
                      </p>
                      <p className="text-blue-600 text-xs mt-1">
                        💡 담당별TO 예시: 영업1팀:5,영업2팀:3,영업3팀:10 (비우면 담당별 TO 없음)
                      </p>
                      <p className="text-red-600 text-xs mt-2">
                        ⚠️ 담당별 TO는 개별 등록에서만 가능합니다
                      </p>
                    </div>

                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBulkTrainingUpload}
                      className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />

                    {bulkPreview.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold mb-2">미리보기 (상위 5개):</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs border">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border px-2 py-1">교육명</th>
                                <th className="border px-2 py-1">템플릿</th>
                                <th className="border px-2 py-1">날짜</th>
                                <th className="border px-2 py-1">시간</th>
                                <th className="border px-2 py-1">교육장</th>
                                <th className="border px-2 py-1">정원</th>
                                <th className="border px-2 py-1">대상</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bulkPreview.map((row, i) => (
                                <tr key={i}>
                                  <td className="border px-2 py-1">{row.title}</td>
                                  <td className="border px-2 py-1">{row.template}</td>
                                  <td className="border px-2 py-1">{row.date}</td>
                                  <td className="border px-2 py-1">{row.time}</td>
                                  <td className="border px-2 py-1">{row.location_type}</td>
                                  <td className="border px-2 py-1">{row.capacity || '무제한'}</td>
                                  <td className="border px-2 py-1">{row.target}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleBulkTrainingSubmit}
                      disabled={bulkLoading || bulkPreview.length === 0}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
                    >
                      {bulkLoading ? '등록 중...' : `${bulkPreview.length}개 교육 일괄 등록`}
                    </button>

                    {bulkMessage && (
                      <p className={`mt-4 font-semibold ${bulkMessage.includes('실패') ? 'text-red-600' : 'text-green-600'}`}>
                        {bulkMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* 교육 목록 */}
                <EventManagement />
              </div>
            )}
        {/* 인원별 교육일정 */}
        {activeTab === 'assignments' && <TrainingAssignments />}

        {/* 변경 요청 */}
        {activeTab === 'requests' && <RequestManagement />}        

        {/* 점수 업로드 */}
        {activeTab === 'scores' && <ScoreManagement />}

        {/* 본부교육 */}
        {activeTab === 'hqedu' && <HQEducationManagement />}

      
      </main>
    </div>
  )
}