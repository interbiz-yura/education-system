'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export default function TrainingSetup() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  
  // 폼 데이터
  const [formData, setFormData] = useState({
    template_id: '',
    title: '',
    assignment_mode: 'DIRECT',
    date_mode: 'SINGLE',
    target_mode: 'ALL',
    location_type: 'ZOOM',
    
    // 단일 날짜 모드
    event_date: '',
    start_time: '',
    end_time: '',
    deadline_date: '',
    capacity: '',
    
    // ⭐ 신규: 담당별 TO 사용 여부
    use_dept_quotas: false,
    dept_quotas: [],
    
    // 배정 대기 모드
    assignment_deadline: '',
    
    // ZOOM 정보
    meeting_id: '',
    meeting_password: '',
    
    // 오프라인 정보
    location_detail: '',
    
    // 특정 담당 모드
    target_departments: [],
    
    // 여러 날짜 옵션
    date_options: [],
    
    // 엑셀 업로드된 대상자 ID 목록
    custom_target_ids: []
  })
  
  // 날짜 옵션 (여러 날짜 모드일 때)
  const [dateOption, setDateOption] = useState({
    event_date: '',
    start_time: '',
    end_time: '',
    capacity: '',
    dept_quotas: [] // ⭐ 날짜별 담당별 TO
  })
  
  // ⭐ 신규: 담당별 TO 입력
  const [deptQuotaInput, setDeptQuotaInput] = useState({
    department: '',
    quota: ''
  })
  
  // 엑셀 업로드 관련
  const [excelFile, setExcelFile] = useState(null)
  const [excelPreview, setExcelPreview] = useState([])
  const [validatedUsers, setValidatedUsers] = useState([])
  
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth()
    loadTemplates()
    loadDepartments()
  }, [])

  const checkAuth = async () => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/')
      return
    }
    
    const userData = JSON.parse(savedUser)
    if (userData.role !== 'SUPER_ADMIN') {
      alert('접근 권한이 없습니다.')
      router.push('/')
      return
    }
    
    setUser(userData)
  }

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('training_templates')
      .select('*')
      .order('name')
    
    if (data) setTemplates(data)
  }

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('users')
      .select('department')
      .not('department', 'is', null)
    
    if (data) {
      const uniqueDepts = [...new Set(data.map(u => u.department))]
      setDepartments(uniqueDepts.filter(d => d).sort())
    }
  }

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        title: template.name
      })
    }
  }

  // ⭐ 신규: 담당별 TO 추가 (단일 날짜용)
  const addDeptQuota = () => {
    if (!deptQuotaInput.department || !deptQuotaInput.quota) {
      alert('담당과 TO를 모두 입력해주세요.')
      return
    }
    
    if (parseInt(deptQuotaInput.quota) < 1) {
      alert('TO는 1명 이상이어야 합니다.')
      return
    }
    
    // 중복 체크
    if (formData.dept_quotas && formData.dept_quotas.find(q => q.department === deptQuotaInput.department)) {
      alert('이미 추가된 담당입니다.')
      return
    }
    
    setFormData({
      ...formData,
      dept_quotas: [...(formData.dept_quotas || []), {
        department: deptQuotaInput.department,
        quota: parseInt(deptQuotaInput.quota)
      }]
    })
    
    setDeptQuotaInput({ department: '', quota: '' })
  }

  // 담당별 TO 삭제 (단일 날짜용)
  const removeDeptQuota = (dept) => {
    setFormData({
      ...formData,
      dept_quotas: formData.dept_quotas.filter(q => q.department !== dept)
    })
  }

  // ⭐ 신규: 날짜 옵션에 담당별 TO 추가
  const addDeptQuotaToDateOption = () => {
    if (!deptQuotaInput.department || !deptQuotaInput.quota) {
      alert('담당과 TO를 모두 입력해주세요.')
      return
    }
    
    if (parseInt(deptQuotaInput.quota) < 1) {
      alert('TO는 1명 이상이어야 합니다.')
      return
    }
    
    if (dateOption.dept_quotas.find(q => q.department === deptQuotaInput.department)) {
      alert('이미 추가된 담당입니다.')
      return
    }
    
    setDateOption({
      ...dateOption,
      dept_quotas: [...dateOption.dept_quotas, {
        department: deptQuotaInput.department,
        quota: parseInt(deptQuotaInput.quota)
      }]
    })
    
    setDeptQuotaInput({ department: '', quota: '' })
  }

  // 날짜 옵션의 담당별 TO 삭제
  const removeDeptQuotaFromDateOption = (dept) => {
    setDateOption({
      ...dateOption,
      dept_quotas: dateOption.dept_quotas.filter(q => q.department !== dept)
    })
  }

  // 날짜 옵션 추가
  const addDateOption = () => {
    if (!dateOption.event_date || !dateOption.start_time || !dateOption.end_time) {
      alert('날짜, 시작시간, 종료시간을 모두 입력해주세요.')
      return
    }
    
    setFormData({
      ...formData,
      date_options: [...formData.date_options, { ...dateOption }]
    })
    
    setDateOption({
      event_date: '',
      start_time: '',
      end_time: '',
      capacity: '',
      dept_quotas: []
    })
  }

  const removeDateOption = (index) => {
    const newOptions = formData.date_options.filter((_, i) => i !== index)
    setFormData({ ...formData, date_options: newOptions })
  }

  const toggleDepartment = (dept) => {
    const current = formData.target_departments
    if (current.includes(dept)) {
      setFormData({
        ...formData,
        target_departments: current.filter(d => d !== dept)
      })
    } else {
      setFormData({
        ...formData,
        target_departments: [...current, dept]
      })
    }
  }

  // 엑셀 파일 업로드
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setExcelFile(file)
    setExcelPreview([])
    setValidatedUsers([])

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        const employeeIds = jsonData
          .slice(1)
          .map(row => String(row[0] || '').trim())
          .filter(id => id && id !== '')

        if (employeeIds.length === 0) {
          alert('사번이 없습니다. 첫 번째 열에 사번을 입력해주세요.')
          return
        }

        const { data: users, error } = await supabase
          .from('users')
          .select('id, employee_id, name, department, sr_name, branch_name, position')
          .in('employee_id', employeeIds)
          .eq('role', 'USER')
          .eq('status', 'ACTIVE')

        if (error) {
          console.error('사번 검증 오류:', error)
          alert('사번 검증 중 오류가 발생했습니다.')
          return
        }

        const foundIds = users.map(u => u.employee_id)
        const notFoundIds = employeeIds.filter(id => !foundIds.includes(id))

        setExcelPreview(employeeIds.slice(0, 10))
        setValidatedUsers(users)
        setFormData({
          ...formData,
          custom_target_ids: users.map(u => u.id)
        })

        if (notFoundIds.length > 0) {
          alert(`⚠️ 총 ${employeeIds.length}명 중 ${users.length}명 확인됨\n\n찾을 수 없는 사번 (${notFoundIds.length}개):\n${notFoundIds.slice(0, 10).join(', ')}${notFoundIds.length > 10 ? '...' : ''}`)
        } else {
          alert(`✅ 총 ${users.length}명 확인 완료!`)
        }

      } catch (error) {
        console.error('엑셀 읽기 오류:', error)
        alert('엑셀 파일을 읽는 중 오류가 발생했습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.template_id || !formData.title) {
      alert('교육 템플릿을 선택해주세요.')
      return
    }

    if (formData.assignment_mode === 'DIRECT') {
      if (formData.date_mode === 'SINGLE') {
        if (!formData.event_date || !formData.start_time || !formData.end_time) {
          alert('날짜와 시간을 모두 입력해주세요.')
          return
        }
      } else {
        if (formData.date_options.length === 0) {
          alert('날짜 옵션을 최소 1개 이상 추가해주세요.')
          return
        }
      }
    } else {
      if (!formData.assignment_deadline) {
        alert('SR 배정 마감일을 입력해주세요.')
        return
      }
      if (formData.date_mode === 'MULTIPLE' && formData.date_options.length === 0) {
        alert('날짜 옵션을 최소 1개 이상 추가해주세요.')
        return
      }
    }

    if (formData.location_type === 'ZOOM') {
      if (!formData.meeting_id) {
        alert('ZOOM 회의 ID를 입력해주세요.')
        return
      }
    } else {
      if (!formData.location_detail) {
        alert('교육장 주소를 입력해주세요.')
        return
      }
    }

    if (formData.target_mode === 'DEPARTMENT' && formData.target_departments.length === 0) {
      alert('담당을 최소 1개 이상 선택해주세요.')
      return
    }

    if (formData.target_mode === 'CUSTOM' && formData.custom_target_ids.length === 0) {
      alert('엑셀 파일을 업로드해주세요.')
      return
    }

    setLoading(true)

    try {
      // 1. training_events 생성
      const eventData = {
        title: formData.title,
        template_id: formData.template_id,
        assignment_mode: formData.assignment_mode,
        date_mode: formData.date_mode,
        target_mode: formData.target_mode,
        location_type: formData.location_type,
        status: formData.assignment_mode === 'DIRECT' ? 'PUBLISHED' : 'DRAFT',
        created_by: user.id
      }

      if (formData.date_mode === 'SINGLE') {
        eventData.event_date = formData.event_date
        eventData.start_time = formData.start_time
        eventData.end_time = formData.end_time
      }

        // 배정 대기 모드일 때
        if (formData.assignment_mode === 'DRAFT') {
        if (formData.assignment_deadline) {
            eventData.assignment_deadline = formData.assignment_deadline
        }
        } else {
        if (formData.deadline_date) {
            eventData.deadline_date = formData.deadline_date
        }
        }

      if (formData.location_type === 'ZOOM') {
        eventData.meeting_id = formData.meeting_id
        eventData.meeting_password = formData.meeting_password
      } else {
        eventData.location_detail = formData.location_detail
      }

      if (formData.target_mode === 'DEPARTMENT') {
        eventData.target_departments = formData.target_departments
      }

        // target_departments가 빈 배열이면 null로 변경
        if (eventData.target_departments && eventData.target_departments.length === 0) {
        delete eventData.target_departments
        }

        const { data: newEvent, error: eventError } = await supabase
        .from('training_events')
        .insert([eventData])
        .select()
        .single()

        if (eventError) {
        console.error('교육 생성 오류:', eventError)
        throw eventError
        }
      if (eventError) throw eventError

      // 2. 날짜 정보 생성
      let dateIds = []
      
      if (formData.date_mode === 'MULTIPLE') {
        // 여러 날짜 옵션
        for (const opt of formData.date_options) {
          const { data: dateData, error: dateError } = await supabase
            .from('training_event_dates')
            .insert([{
              event_id: newEvent.id,
              event_date: opt.event_date,
              start_time: opt.start_time,
              end_time: opt.end_time,
              capacity: opt.capacity || null
            }])
            .select()
            .single()

          if (dateError) throw dateError
          
          dateIds.push(dateData.id)
          
          // ⭐ 담당별 TO가 있으면 추가
          if (opt.dept_quotas && opt.dept_quotas.length > 0) {
            const quotaInserts = opt.dept_quotas.map(q => ({
              event_date_id: dateData.id,
              department: q.department,
              quota: q.quota
            }))
            
            const { error: quotaError } = await supabase
              .from('training_date_department_quotas')
              .insert(quotaInserts)
            
            if (quotaError) throw quotaError
          }
        }
        
      } else if (formData.date_mode === 'SINGLE') {
        // 단일 날짜
        if (formData.capacity || (formData.dept_quotas && formData.dept_quotas.length > 0)) {
          const { data: dateData, error: dateError } = await supabase
            .from('training_event_dates')
            .insert([{
              event_id: newEvent.id,
              event_date: formData.event_date,
              start_time: formData.start_time,
              end_time: formData.end_time,
              capacity: formData.capacity ? parseInt(formData.capacity) : null
            }])
            .select()
            .single()

          if (dateError) throw dateError
          
          dateIds.push(dateData.id)
          
          // ⭐ 담당별 TO 추가
          if (formData.dept_quotas && formData.dept_quotas.length > 0) {
            const quotaInserts = formData.dept_quotas.map(q => ({
              event_date_id: dateData.id,
              department: q.department,
              quota: q.quota
            }))
            
            const { error: quotaError } = await supabase
              .from('training_date_department_quotas')
              .insert(quotaInserts)
            
            if (quotaError) throw quotaError
          }
        }
      }

      // 3. 배정 대기 모드일 때 training_target_pool 생성
      if (formData.assignment_mode === 'DRAFT') {
        let targetUserIds = []

        if (formData.target_mode === 'ALL') {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'USER')
            .eq('status', 'ACTIVE')

          if (usersError) throw usersError
          targetUserIds = users.map(u => u.id)

        } else if (formData.target_mode === 'DEPARTMENT') {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'USER')
            .eq('status', 'ACTIVE')
            .in('department', formData.target_departments)

          if (usersError) throw usersError
          targetUserIds = users.map(u => u.id)

        } else if (formData.target_mode === 'CUSTOM') {
          targetUserIds = formData.custom_target_ids
        }

        const poolInserts = targetUserIds.map(userId => ({
          event_id: newEvent.id,
          user_id: userId,
          status: 'AVAILABLE'
        }))

        const { error: poolError } = await supabase
          .from('training_target_pool')
          .insert(poolInserts)

        if (poolError) throw poolError

        alert(`✅ 교육 등록 완료!\n대상자 ${targetUserIds.length}명이 배정 대기 중입니다.`)
      } else {
        alert('✅ 교육 등록 완료!')
      }

      router.push('/admin')

    } catch (error) {
      console.error('교육 등록 오류:', error)
      alert('교육 등록 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return <div className="p-8">로딩 중...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">교육 등록</h1>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← 돌아가기
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. 교육 템플릿 선택 */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold mb-4">1. 교육 정보</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    교육 템플릿 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.template_id}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="">선택하세요</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">💡 템플릿은 교육 종류 구분용입니다 (통계/분석 시 활용)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    교육명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="예: 역량강화교육 (1월)"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. 배정 방식 */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold mb-4">2. 배정 방식</h2>
              
              <div className="space-y-3">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="DIRECT"
                    checked={formData.assignment_mode === 'DIRECT'}
                    onChange={(e) => setFormData({ ...formData, assignment_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">즉시 배정</div>
                    <div className="text-sm text-gray-600">관리자가 직접 대상자를 지정하여 즉시 확정</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="DRAFT"
                    checked={formData.assignment_mode === 'DRAFT'}
                    onChange={(e) => setFormData({ ...formData, assignment_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">배정 대기</div>
                    <div className="text-sm text-gray-600">SR들이 담당 인원을 배정한 후 관리자가 승인</div>
                  </div>
                </label>
              </div>

              {formData.assignment_mode === 'DRAFT' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">
                    SR 배정 마감일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.assignment_deadline}
                    onChange={(e) => setFormData({ ...formData, assignment_deadline: e.target.value })}
                    className="px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              )}
            </div>

            {/* 3. 날짜 설정 */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold mb-4">3. 날짜 설정</h2>
              
              <div className="space-y-3 mb-4">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="SINGLE"
                    checked={formData.date_mode === 'SINGLE'}
                    onChange={(e) => setFormData({ ...formData, date_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">단일 날짜</div>
                    <div className="text-sm text-gray-600">모든 대상자가 같은 날짜에 교육 참여</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="MULTIPLE"
                    checked={formData.date_mode === 'MULTIPLE'}
                    onChange={(e) => setFormData({ ...formData, date_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">여러 날짜 옵션</div>
                    <div className="text-sm text-gray-600">여러 날짜 중 선택 (SR이 배정 시 선택)</div>
                  </div>
                </label>
              </div>

              {formData.date_mode === 'SINGLE' && (
                <div>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        교육 날짜 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.event_date}
                        onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        시작 시간 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        종료 시간 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        전체 정원 (선택)
                      </label>
                      <input
                        type="number"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="제한없음"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* ⭐ 신규: 담당별 TO 설정 */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium">담당별 TO 설정 (선택)</div>
                      <div className="text-xs text-gray-600">예: 거점교육에서 영업1팀 5명, 영업2팀 3명</div>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                      <select
                        value={deptQuotaInput.department}
                        onChange={(e) => setDeptQuotaInput({ ...deptQuotaInput, department: e.target.value })}
                        className="flex-1 px-3 py-2 border rounded-lg"
                      >
                        <option value="">담당 선택</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={deptQuotaInput.quota}
                        onChange={(e) => setDeptQuotaInput({ ...deptQuotaInput, quota: e.target.value })}
                        className="w-24 px-3 py-2 border rounded-lg"
                        placeholder="TO"
                        min="1"
                      />
                      <button
                        type="button"
                        onClick={addDeptQuota}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        추가
                      </button>
                    </div>

                    {formData.dept_quotas && formData.dept_quotas.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-600 mb-1">설정된 담당별 TO ({formData.dept_quotas.length}개)</div>
                        {formData.dept_quotas.map((q, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white border rounded">
                            <span className="text-sm">{q.department}: {q.quota}명</span>
                            <button
                              type="button"
                              onClick={() => removeDeptQuota(q.department)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-600 mt-2">
                      💡 담당별 TO 설정 시, 각 담당은 설정한 인원만큼만 배정 가능합니다
                    </p>
                  </div>
                </div>
              )}

              {formData.date_mode === 'MULTIPLE' && (
                <div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium mb-2">날짜</label>
                        <input
                          type="date"
                          value={dateOption.event_date}
                          onChange={(e) => setDateOption({ ...dateOption, event_date: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">시작</label>
                        <input
                          type="time"
                          value={dateOption.start_time}
                          onChange={(e) => setDateOption({ ...dateOption, start_time: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">종료</label>
                        <input
                          type="time"
                          value={dateOption.end_time}
                          onChange={(e) => setDateOption({ ...dateOption, end_time: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">전체 정원</label>
                        <input
                          type="number"
                          value={dateOption.capacity}
                          onChange={(e) => setDateOption({ ...dateOption, capacity: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="제한없음"
                        />
                      </div>
                    </div>

                    {/* ⭐ 신규: 날짜 옵션별 담당별 TO */}
                    <div className="bg-white p-3 rounded-lg mb-3">
                      <div className="text-xs font-medium mb-2">이 날짜의 담당별 TO (선택)</div>
                      <div className="flex gap-2 mb-2">
                        <select
                          value={deptQuotaInput.department}
                          onChange={(e) => setDeptQuotaInput({ ...deptQuotaInput, department: e.target.value })}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        >
                          <option value="">담당 선택</option>
                          {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={deptQuotaInput.quota}
                          onChange={(e) => setDeptQuotaInput({ ...deptQuotaInput, quota: e.target.value })}
                          className="w-20 px-2 py-1 border rounded text-sm"
                          placeholder="TO"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={addDeptQuotaToDateOption}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                        >
                          추가
                        </button>
                      </div>

                      {dateOption.dept_quotas.length > 0 && (
                        <div className="space-y-1">
                          {dateOption.dept_quotas.map((q, index) => (
                            <div key={index} className="flex items-center justify-between p-1.5 bg-gray-50 border rounded">
                              <span className="text-xs">{q.department}: {q.quota}명</span>
                              <button
                                type="button"
                                onClick={() => removeDeptQuotaFromDateOption(q.department)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                삭제
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={addDateOption}
                      className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      + 날짜 옵션 추가
                    </button>
                  </div>

                  {formData.date_options.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium mb-2">추가된 날짜 옵션 ({formData.date_options.length}개)</div>
                      {formData.date_options.map((opt, index) => (
                        <div key={index} className="p-3 bg-white border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">
                              {opt.event_date} | {opt.start_time} - {opt.end_time}
                              {opt.capacity && ` | 전체 정원 ${opt.capacity}명`}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDateOption(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              삭제
                            </button>
                          </div>
                          {opt.dept_quotas && opt.dept_quotas.length > 0 && (
                            <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                              담당별 TO: {opt.dept_quotas.map(q => `${q.department} ${q.quota}명`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {formData.assignment_mode === 'DIRECT' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">
                    신청 마감일 (선택)
                  </label>
                  <input
                    type="date"
                    value={formData.deadline_date}
                    onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                    className="px-4 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">매니저 화면에 표시될 마감일</p>
                </div>
              )}
            </div>

            {/* 4. 교육장 정보 */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold mb-4">4. 교육장 정보</h2>
              
              <div className="space-y-3 mb-4">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="ZOOM"
                    checked={formData.location_type === 'ZOOM'}
                    onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                    className="mr-3"
                  />
                  <div className="font-medium">ZOOM (화상교육)</div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="OFFLINE"
                    checked={formData.location_type === 'OFFLINE'}
                    onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                    className="mr-3"
                  />
                  <div className="font-medium">오프라인 (현장교육)</div>
                </label>
              </div>

              {formData.location_type === 'ZOOM' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ZOOM 회의 ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.meeting_id}
                      onChange={(e) => setFormData({ ...formData, meeting_id: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="예: 123 456 7890"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ZOOM 비밀번호
                    </label>
                    <input
                      type="text"
                      value={formData.meeting_password}
                      onChange={(e) => setFormData({ ...formData, meeting_password: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="예: 0000"
                    />
                  </div>
                </div>
              )}

              {formData.location_type === 'OFFLINE' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    교육장 주소 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.location_detail}
                    onChange={(e) => setFormData({ ...formData, location_detail: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows="3"
                    placeholder="예: 서울시 강남구 테헤란로 123 LG전자 빌딩 5층 대회의실"
                    required
                  />
                </div>
              )}
            </div>

            {/* 5. 대상자 설정 */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-semibold mb-4">5. 대상자 설정</h2>
              
              <div className="space-y-3 mb-4">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="ALL"
                    checked={formData.target_mode === 'ALL'}
                    onChange={(e) => setFormData({ ...formData, target_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">전체 매니저</div>
                    <div className="text-sm text-gray-600">현재 활성 상태인 모든 매니저</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="DEPARTMENT"
                    checked={formData.target_mode === 'DEPARTMENT'}
                    onChange={(e) => setFormData({ ...formData, target_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">특정 담당만</div>
                    <div className="text-sm text-gray-600">선택한 담당의 매니저만 대상</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="CUSTOM"
                    checked={formData.target_mode === 'CUSTOM'}
                    onChange={(e) => setFormData({ ...formData, target_mode: e.target.value })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">엑셀 업로드 ⭐</div>
                    <div className="text-sm text-gray-600">엑셀 파일로 대상자 지정 (첫 번째 열에 사번)</div>
                  </div>
                </label>
              </div>

              {formData.target_mode === 'DEPARTMENT' && (
                <div>
                  <div className="text-sm font-medium mb-2">담당 선택 <span className="text-red-500">*</span></div>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {departments.map(dept => (
                      <label key={dept} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.target_departments.includes(dept)}
                          onChange={() => toggleDepartment(dept)}
                          className="mr-2"
                        />
                        <span className="text-sm">{dept}</span>
                      </label>
                    ))}
                  </div>
                  {formData.target_departments.length > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      선택됨: {formData.target_departments.length}개 담당
                    </div>
                  )}
                </div>
              )}

              {formData.target_mode === 'CUSTOM' && (
                <div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm font-medium mb-2">엑셀 파일 업로드</div>
                    <p className="text-xs text-gray-600 mb-3">
                      첫 번째 열에 사번만 입력하세요. 첫 행은 헤더로 건너뜁니다.<br/>
                      예시: | 사번 |<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| 10001 |<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| 10002 |
                    </p>
                    
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />

                    {validatedUsers.length > 0 && (
                      <div className="mt-3 p-3 bg-white rounded border">
                        <div className="text-sm font-medium mb-2">
                          ✅ 확인된 인원: {validatedUsers.length}명
                        </div>
                        <div className="text-xs text-gray-600 max-h-32 overflow-y-auto">
                          {excelPreview.map((id, i) => (
                            <div key={i}>{id}</div>
                          ))}
                          {excelPreview.length < validatedUsers.length && (
                            <div>...외 {validatedUsers.length - excelPreview.length}명</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 제출 버튼 */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? '등록 중...' : '교육 등록'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}