'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import UserManagement from './users'
import EventManagement from './events'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncMode, setSyncMode] = useState(false)

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

      <main className="max-w-5xl mx-auto p-4">
        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded ${activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            📤 엑셀 업로드
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            👥 인원 관리
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded ${activeTab === 'events' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          >
            📅 교육 일정
          </button>
        </div>

        {/* 엑셀 업로드 */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">📋 인원 마스터 엑셀 업로드</h2>
            
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
        )}

        {/* 인원 관리 */}
        {activeTab === 'users' && <UserManagement />}

        {/* 교육 일정 */}
        {activeTab === 'events' && <EventManagement />}
      </main>
    </div>
  )
}